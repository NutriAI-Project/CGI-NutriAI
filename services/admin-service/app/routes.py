"""
Admin Service - API Routes
"""
import logging
import uuid
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import User, Document, DietPlan, HealthLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(request: Request):
    role = request.headers.get("X-User-Role")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/dashboard")
async def admin_dashboard(request: Request, db: Session = Depends(get_db)):
    require_admin(request)

    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar()
    total_documents = db.query(func.count(Document.id)).scalar()
    total_diet_plans = db.query(func.count(DietPlan.id)).scalar()
    total_health_logs = db.query(func.count(HealthLog.id)).scalar()
    completed_ocr = db.query(func.count(Document.id)).filter(Document.ocr_status == "completed").scalar()
    failed_ocr = db.query(func.count(Document.id)).filter(Document.ocr_status == "failed").scalar()
    admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_documents": total_documents,
        "total_diet_plans": total_diet_plans,
        "total_health_logs": total_health_logs,
        "completed_ocr": completed_ocr,
        "failed_ocr": failed_ocr,
        "admin_count": admin_count,
    }


@router.get("/users")
async def list_users(request: Request, db: Session = Depends(get_db)):
    require_admin(request)

    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "auth_type": u.auth_type,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.post("/users/{user_id}/toggle")
async def toggle_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    admin_id = request.headers.get("X-User-ID")

    try:
        user_uuid = uuid.UUID(user_id)
        admin_uuid = uuid.UUID(admin_id) if admin_id else None
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid format for user ID or admin ID."})

    if user_uuid == admin_uuid:
        return JSONResponse(status_code=400, content={"error": "Cannot deactivate your own account."})

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        return JSONResponse(status_code=404, content={"error": "User not found."})

    user.is_active = not user.is_active
    db.commit()

    status = "activated" if user.is_active else "deactivated"
    return {"message": f"User {user.username} has been {status}.", "is_active": user.is_active}


@router.get("/documents")
async def list_all_documents(request: Request, db: Session = Depends(get_db)):
    require_admin(request)

    docs = (
        db.query(Document, User.username)
        .join(User, User.id == Document.user_id, isouter=True)
        .order_by(Document.uploaded_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": str(doc.id),
            "user_id": str(doc.user_id),
            "username": username or "Unknown",
            "document_type": doc.document_type,
            "original_filename": doc.original_filename,
            "ocr_status": doc.ocr_status,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        }
        for doc, username in docs
    ]
