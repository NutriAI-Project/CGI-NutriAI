"""
Auth Service - API Routes
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserRegister, UserResponse
from app.services import (
    authenticate_user,
    create_user,
    create_access_token,
    get_auth_url,
    acquire_token_by_code,
    get_or_create_entra_user,
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid email or password. Please try again."},
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    response = JSONResponse(content={
        "message": "Login successful",
        "user": UserResponse.from_orm(user).model_dump(mode="json"),
    })
    response.set_cookie(  # NOSONAR
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False,
    )
    return response


@router.post("/register")
async def register(payload: UserRegister, db: Session = Depends(get_db)):
    errors = []

    if payload.password != payload.confirm_password:
        errors.append("Passwords do not match.")
    if len(payload.password) < 6:
        errors.append("Password must be at least 6 characters.")
    if len(payload.username) < 3:
        errors.append("Username must be at least 3 characters.")
    if db.query(User).filter(User.email == payload.email).first():
        errors.append("An account with this email already exists.")
    if db.query(User).filter(User.username == payload.username).first():
        errors.append("This username is already taken.")

    if errors:
        return JSONResponse(status_code=400, content={"errors": errors})

    try:
        user = create_user(
            db=db,
            email=payload.email,
            username=payload.username,
            password=payload.password,
            full_name=payload.full_name,
            age=payload.age,
            gender=payload.gender,
            weight=payload.weight,
            height=payload.height,
        )

        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        response = JSONResponse(content={
            "message": "Registration successful",
            "user": UserResponse.from_orm(user).model_dump(mode="json"),
        })
        response.set_cookie(  # NOSONAR
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=False,
        )
        return response

    except SQLAlchemyError as e:
        logger.error(f"Registration error: {e}")
        return JSONResponse(
            status_code=500,
            content={"errors": ["An error occurred during registration. Please try again."]},
        )


@router.get("/forgot-password")
async def forgot_password():
    return JSONResponse(content={"message": "Password reset functionality. Check your email for instructions."})


@router.get("/microsoft")
async def microsoft_login():
    try:
        auth_url = get_auth_url()
        return JSONResponse(content={"auth_url": auth_url})
    except (ValueError, OSError) as e:
        logger.error(f"Error initiating Microsoft login: {e}")
        return JSONResponse(status_code=500, content={"error": "Failed to initiate SSO"})


@router.get("/callback")
async def microsoft_callback(
    request: Request,
    code: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    from urllib.parse import urlparse
    parsed_uri = urlparse(settings.ENTRA_REDIRECT_URI)
    base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
    if "localhost:8000" in base_url:
        base_url = "http://localhost:5173"
    
    frontend_login = f"{base_url.rstrip('/')}/login"
    frontend_dashboard = f"{base_url.rstrip('/')}/dashboard"

    if error:
        logger.error(f"Entra ID callback error: {error}")
        return RedirectResponse(url=f"{frontend_login}?error=sso_denied")

    if not code:
        return RedirectResponse(url=f"{frontend_login}?error=missing_code")

    try:
        token_result = acquire_token_by_code(code)
        if not token_result:
            return RedirectResponse(url=f"{frontend_login}?error=token_failed")

        user, is_new_user = get_or_create_entra_user(db, token_result)
        if not user:
            return RedirectResponse(url=f"{frontend_login}?error=user_failed")

        access_token = create_access_token(
            data={"sub": str(user.id), "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        sso_param = "sso=registered" if is_new_user else "sso=login"
        response = RedirectResponse(url=f"{frontend_dashboard}?{sso_param}")
        response.set_cookie(  # NOSONAR
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=False,
        )
        return response

    except (SQLAlchemyError, ValueError, OSError) as e:
        logger.error(f"Error in Microsoft callback: {e}")
        return RedirectResponse(url=f"{frontend_login}?error=sso_failed")


@router.get("/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(key="access_token")
    return response


@router.get("/me")
async def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    allergies = [
        {"id": str(a.id), "allergen_name": a.allergen_name, "severity": a.severity, "notes": a.notes}
        for a in user.allergies
    ]

    profile_data = None
    if user.profile:
        profile_data = {
            "medical_conditions": user.profile.medical_conditions or [],
            "dietary_preferences": user.profile.dietary_preferences or [],
            "blood_type": user.profile.blood_type,
            "emergency_contact": user.profile.emergency_contact,
        }

    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "age": user.age,
        "gender": user.gender,
        "weight": user.weight,
        "height": user.height,
        "auth_type": user.auth_type,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat(),
        "allergies": allergies,
        "profile": profile_data,
    }
