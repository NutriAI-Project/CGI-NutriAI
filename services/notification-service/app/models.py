"""
Notification Service - Database Models
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info", nullable=False)  # success, info, warning, danger
    icon = Column(String(50), default="fa-bell")
    is_read = Column(Boolean, default=False, nullable=False)
    email_sent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
