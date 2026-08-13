"""
Health Service - API Routes
"""
import logging
import uuid
from datetime import date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_db
from app.models import HealthLog, MealLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health-tracker", tags=["Health Tracker"])

INVALID_USER_ID_FORMAT = "Invalid user ID format"


class HealthLogCreate(BaseModel):
    log_date: str
    weight: Optional[float] = None
    blood_sugar_fasting: Optional[float] = None
    blood_sugar_postprandial: Optional[float] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    notes: Optional[str] = None


class MealLogCreate(BaseModel):
    meal_date: str
    meal_type: str
    food_items: str = ""
    calories_estimate: Optional[int] = None
    notes: Optional[str] = None


@router.get(
    "/data",
    responses={
        400: {"description": INVALID_USER_ID_FORMAT},
        401: {"description": "Not authenticated"},
    }
)
async def chart_data(request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=INVALID_USER_ID_FORMAT)

    thirty_days_ago = date.today() - timedelta(days=30)
    health_logs = (
        db.query(HealthLog)
        .filter(HealthLog.user_id == user_id, HealthLog.log_date >= thirty_days_ago)
        .order_by(HealthLog.log_date.asc())
        .all()
    )

    meal_logs = (
        db.query(MealLog)
        .filter(MealLog.user_id == user_id, MealLog.meal_date >= thirty_days_ago)
        .order_by(MealLog.meal_date.desc(), MealLog.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "chart_data": {
            "labels": [log.log_date.isoformat() for log in health_logs],
            "weight": [log.weight for log in health_logs],
            "blood_sugar_fasting": [log.blood_sugar_fasting for log in health_logs],
            "blood_sugar_postprandial": [log.blood_sugar_postprandial for log in health_logs],
            "bp_systolic": [log.blood_pressure_systolic for log in health_logs],
            "bp_diastolic": [log.blood_pressure_diastolic for log in health_logs],
        },
        "health_logs": [
            {
                "id": str(log.id),
                "log_date": log.log_date.isoformat(),
                "weight": log.weight,
                "blood_sugar_fasting": log.blood_sugar_fasting,
                "blood_sugar_postprandial": log.blood_sugar_postprandial,
                "blood_pressure_systolic": log.blood_pressure_systolic,
                "blood_pressure_diastolic": log.blood_pressure_diastolic,
                "notes": log.notes,
            }
            for log in health_logs
        ],
        "meal_logs": [
            {
                "id": str(log.id),
                "meal_date": log.meal_date.isoformat(),
                "meal_type": log.meal_type,
                "food_items": log.food_items,
                "calories_estimate": log.calories_estimate,
                "notes": log.notes,
            }
            for log in meal_logs
        ],
        "today": date.today().isoformat(),
    }


@router.post(
    "/log",
    responses={
        400: {"description": "Invalid user ID format or date format"},
        401: {"description": "Not authenticated"},
    }
)
async def add_health_log(payload: HealthLogCreate, request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=INVALID_USER_ID_FORMAT)

    try:
        parsed_date = date.fromisoformat(payload.log_date)
        health_log = HealthLog(
            user_id=user_id,
            log_date=parsed_date,
            weight=payload.weight,
            blood_sugar_fasting=payload.blood_sugar_fasting,
            blood_sugar_postprandial=payload.blood_sugar_postprandial,
            blood_pressure_systolic=payload.blood_pressure_systolic,
            blood_pressure_diastolic=payload.blood_pressure_diastolic,
            notes=payload.notes,
        )
        db.add(health_log)
        db.commit()
        return {"message": "Health log saved successfully!"}

    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format."})
    except SQLAlchemyError as e:
        logger.error(f"Error saving health log: {e}")
        db.rollback()
        return JSONResponse(status_code=500, content={"error": "Failed to save health log."})


@router.post(
    "/meal",
    responses={
        400: {"description": "Invalid user ID format, date format, or meal type"},
        401: {"description": "Not authenticated"},
    }
)
async def add_meal_log(payload: MealLogCreate, request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=INVALID_USER_ID_FORMAT)

    try:
        parsed_date = date.fromisoformat(payload.meal_date)
        food_list = [item.strip() for item in payload.food_items.split(",") if item.strip()]

        if payload.meal_type not in ("breakfast", "lunch", "dinner", "snack"):
            return JSONResponse(status_code=400, content={"error": "Invalid meal type."})

        meal_log = MealLog(
            user_id=user_id,
            meal_date=parsed_date,
            meal_type=payload.meal_type,
            food_items=food_list,
            calories_estimate=payload.calories_estimate,
            notes=payload.notes,
        )
        db.add(meal_log)
        db.commit()
        return {"message": "Meal log saved successfully!"}

    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format."})
    except SQLAlchemyError as e:
        logger.error(f"Error saving meal log: {e}")
        db.rollback()
        return JSONResponse(status_code=500, content={"error": "Failed to save meal log."})
