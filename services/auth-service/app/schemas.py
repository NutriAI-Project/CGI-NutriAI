"""
Auth Service - Pydantic Schemas
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UserLogin(BaseModel):
    email: str
    password: str


class UserRegister(BaseModel):
    email: str = Field(..., max_length=255)
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str
    full_name: str = Field(..., max_length=255)
    age: Optional[int] = Field(None, ge=1, le=150)
    gender: Optional[str] = Field(None, max_length=20)
    weight: Optional[float] = Field(None, ge=1, le=500)
    height: Optional[float] = Field(None, ge=30, le=300)


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    auth_type: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AllergyResponse(BaseModel):
    id: UUID
    allergen_name: str
    severity: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True
