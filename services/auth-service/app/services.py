"""
Auth Service - Business Logic
Password hashing, JWT management, and Microsoft Entra ID SSO.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import msal
import jwt
from jwt.exceptions import PyJWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User, PatientProfile

logger = logging.getLogger(__name__)
settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
    except PyJWTError as e:
        logger.error(f"Error decoding token: {e}")
        return None


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if user.auth_type != "local":
        return None
    if not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def create_user(
    db: Session,
    email: str,
    username: str,
    password: str,
    full_name: str,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    weight: Optional[float] = None,
    height: Optional[float] = None,
) -> User:
    hashed = hash_password(password)
    user = User(
        email=email,
        username=username,
        hashed_password=hashed,
        full_name=full_name,
        age=age,
        gender=gender,
        weight=weight,
        height=height,
        auth_type="local",
        role="patient",
        is_active=True,
    )
    db.add(user)
    db.flush()

    profile = PatientProfile(
        user_id=user.id,
        medical_conditions=[],
        dietary_preferences=[],
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


# Microsoft Entra ID SSO
def get_msal_app() -> msal.ConfidentialClientApplication:
    # Use 'common' authority to support multitenant and personal Microsoft accounts
    authority = "https://login.microsoftonline.com/common"
    return msal.ConfidentialClientApplication(
        client_id=settings.ENTRA_CLIENT_ID,
        client_credential=settings.ENTRA_CLIENT_SECRET,
        authority=authority,
    )



def get_auth_url() -> str:
    app = get_msal_app()
    return app.get_authorization_request_url(
        scopes=["User.Read"],
        redirect_uri=settings.ENTRA_REDIRECT_URI,
        prompt="select_account",
    )


def acquire_token_by_code(code: str) -> Optional[dict]:
    try:
        app = get_msal_app()
        result = app.acquire_token_by_authorization_code(
            code=code,
            scopes=["User.Read"],
            redirect_uri=settings.ENTRA_REDIRECT_URI,
        )
        if "error" in result:
            logger.error(f"Entra ID token error: {result.get('error_description', result.get('error'))}")
            return None
        return result
    except (ValueError, KeyError, OSError) as e:
        logger.error(f"Error acquiring token by code: {e}")
        return None


def get_or_create_entra_user(db: Session, token_result: dict) -> tuple:
    try:
        id_token_claims = token_result.get("id_token_claims", {})
        oid = id_token_claims.get("oid")
        email = id_token_claims.get("preferred_username") or id_token_claims.get("email", "")
        name = id_token_claims.get("name", email.split("@")[0])

        if not oid or not email:
            logger.error("Missing oid or email in Entra ID claims")
            return None, False

        user = db.query(User).filter(User.entra_oid == oid).first()
        if user:
            return user, False

        user = db.query(User).filter(User.email == email).first()
        if user:
            user.entra_oid = oid
            user.auth_type = "entra_id"
            db.commit()
            db.refresh(user)
            return user, False

        username = email.split("@")[0]
        base_username = username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            email=email,
            username=username,
            full_name=name,
            auth_type="entra_id",
            entra_oid=oid,
            role="patient",
            is_active=True,
        )
        db.add(user)
        db.flush()

        profile = PatientProfile(
            user_id=user.id,
            medical_conditions=[],
            dietary_preferences=[],
        )
        db.add(profile)
        db.commit()
        db.refresh(user)
        return user, True

    except (ValueError, KeyError, OSError) as e:
        logger.error(f"Error creating Entra ID user: {e}")
        db.rollback()
        return None, False

