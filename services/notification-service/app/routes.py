"""
Notification Service - API Routes
"""
import logging
import uuid
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Notification

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/list",
    responses={
        400: {"description": "Invalid user ID format"},
        401: {"description": "Not authenticated"},
    }
)
async def list_notifications(request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    ).scalar()

    return {
        "notifications": [
            {
                "id": str(n.id),
                "message": n.message,
                "type": n.type,
                "icon": n.icon,
                "is_read": n.is_read,
                "email_sent": n.email_sent,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ],
        "unread_count": unread_count,
    }


@router.post(
    "/{notification_id}/read",
    responses={
        400: {"description": "Invalid format for user ID or notification ID"},
        401: {"description": "Not authenticated"},
    }
)
async def mark_as_read(notification_id: str, request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid format for user ID or notification ID")

    notification = db.query(Notification).filter(
        Notification.id == notif_uuid,
        Notification.user_id == user_id,
    ).first()

    if notification:
        notification.is_read = True
        db.commit()

    return {"message": "Notification marked as read."}


@router.get(
    "/count",
    responses={
        400: {"description": "Invalid user ID format"},
        401: {"description": "Not authenticated"},
    }
)
async def notification_count(request: Request, db: Session = Depends(get_db)):
    user_id_str = request.headers.get("X-User-ID")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    ).scalar()

    return {"count": count}
