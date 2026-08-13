"""
Admin Service - Database Models (read-only references)
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    auth_type = Column(String(20), default="local")
    entra_oid = Column(String(255), nullable=True)
    role = Column(String(20), default="patient")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    document_type = Column(String(50))
    original_filename = Column(String(500), nullable=False)
    blob_name = Column(String(500))
    blob_url = Column(String(1000))
    ocr_content = Column(Text, nullable=True)
    ocr_status = Column(String(20))
    uploaded_at = Column(DateTime)

class DietPlan(Base):
    __tablename__ = "diet_plans"
    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    document_ids = Column(JSON, default=list)
    plan_title = Column(String(500), nullable=False)
    plan_summary = Column(Text, nullable=True)
    foods_to_eat = Column(JSON, default=list)
    foods_to_avoid = Column(JSON, default=list)
    weekly_meal_plan = Column(JSON, default=dict)
    nutritional_guidelines = Column(JSON, default=dict)
    allergy_notes = Column(JSON, default=list)
    additional_recommendations = Column(JSON, default=list)
    generated_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

class HealthLog(Base):
    __tablename__ = "health_logs"
    id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    log_date = Column(DateTime)
    weight = Column(Float, nullable=True)
    blood_sugar_fasting = Column(Float, nullable=True)
    blood_sugar_postprandial = Column(Float, nullable=True)
    blood_pressure_systolic = Column(Integer, nullable=True)
    blood_pressure_diastolic = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime)
