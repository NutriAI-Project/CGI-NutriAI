"""
Auth Service - Database Models
User, PatientProfile, and FoodAllergy models.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Enum, JSON
)
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from sqlalchemy.orm import relationship

from app.database import Base

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified uuid.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(pgUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            if isinstance(value, uuid.UUID):
                return value
            return uuid.UUID(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(uuid.UUID(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    auth_type = Column(
        Enum("local", "entra_id", name="auth_type_enum", create_type=False),
        default="local",
        nullable=False,
    )
    entra_oid = Column(String(255), unique=True, nullable=True)
    role = Column(
        Enum("patient", "admin", name="role_enum", create_type=False),
        default="patient",
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    allergies = relationship("FoodAllergy", back_populates="user", cascade="all, delete-orphan")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    medical_conditions = Column(JSON, default=list)
    dietary_preferences = Column(JSON, default=list)
    blood_type = Column(String(10), nullable=True)
    emergency_contact = Column(String(255), nullable=True)

    user = relationship("User", back_populates="profile")


class FoodAllergy(Base):
    __tablename__ = "food_allergies"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    allergen_name = Column(String(255), nullable=False)
    severity = Column(
        Enum("mild", "moderate", "severe", name="severity_enum", create_type=False),
        nullable=False,
        default="moderate",
    )
    notes = Column(Text, nullable=True)

    user = relationship("User", back_populates="allergies")
