import os
import uuid
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

# Override env vars BEFORE importing any app modules.
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-unit-tests-32bytes"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User, PatientProfile, FoodAllergy
from app.services import hash_password, create_access_token

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_user(db_session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="testuser@example.com",
        username="testuser",
        hashed_password=hash_password("TestPassword123!"),
        full_name="Test User",
        age=30,
        gender="male",
        weight=75.0,
        height=175.0,
        auth_type="local",
        role="patient",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def admin_user(db_session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="admin@example.com",
        username="adminuser",
        hashed_password=hash_password("AdminPassword123!"),
        full_name="Admin User",
        age=35,
        gender="female",
        role="admin",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def auth_token(test_user):
    return create_access_token(data={"sub": str(test_user.id), "role": test_user.role})

@pytest.fixture
def admin_token(admin_user):
    return create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role})

@pytest.fixture
def authenticated_client(client, auth_token):
    client.cookies.set("access_token", auth_token)
    return client

@pytest.fixture
def admin_client(client, admin_token):
    client.cookies.set("access_token", admin_token)
    return client
