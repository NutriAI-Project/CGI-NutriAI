import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError
import uuid

from app.database import get_db, check_db_health
from app.models import User, PatientProfile
from app.services import authenticate_user
from app.routes import get_current_user, register
from app.schemas import UserRegister
from app.main import app, lifespan
from fastapi.testclient import TestClient
from fastapi import HTTPException

# --- app/database.py tests ---

def test_get_db_generator():
    """Verify that get_db yields a session and closes it."""
    db_gen = get_db()
    db_session = next(db_gen)
    # The session should be active/usable
    assert db_session is not None
    # Clean up by closing the generator
    with pytest.raises(StopIteration):
        next(db_gen)

def test_check_db_health_failure():
    """Verify check_db_health returns False when connection raises SQLAlchemyError."""
    with patch("app.database.engine.connect") as mock_connect:
        mock_connect.side_effect = SQLAlchemyError("Connection failed")
        assert check_db_health() is False


# --- app/main.py lifespan tests ---

@pytest.mark.asyncio
async def test_lifespan_admin_already_exists():
    """Verify lifespan else block runs if admin user already exists."""
    from fastapi import FastAPI
    app_mock = FastAPI()
    # Trigger lifespan first time (seeds the admin user)
    async with lifespan(app_mock):
        pass
    # Trigger lifespan second time (finds existing admin user and logs it)
    async with lifespan(app_mock):
        pass

@pytest.mark.asyncio
async def test_lifespan_seeding_error():
    """Verify seeding error is caught and database is rolled back."""
    from fastapi import FastAPI
    app_mock = FastAPI()
    with patch("app.database.SessionLocal") as mock_session_local:
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("Database seed error")
        mock_session_local.return_value = mock_db
        async with lifespan(app_mock):
            pass
        mock_db.rollback.assert_called_once()

@pytest.mark.asyncio
async def test_lifespan_db_creation_error():
    """Verify table creation error is caught."""
    from fastapi import FastAPI
    app_mock = FastAPI()
    with patch("app.database.Base.metadata.create_all") as mock_create:
        mock_create.side_effect = SQLAlchemyError("Table creation error")
        async with lifespan(app_mock):
            pass


# --- app/routes.py register validation and error tests ---

@pytest.mark.asyncio
async def test_register_validation_errors_via_handler(db_session):
    """Verify route handler's internal validation checks on passwords and usernames."""
    # Since Pydantic prevents short values from reaching the endpoint, we construct
    # the model directly using model_construct to bypass schema validation
    payload = UserRegister.model_construct(
        email="short@example.com",
        username="us",
        password="123",
        confirm_password="123",
        full_name="Valid Name",
        age=30,
        gender="male",
        weight=70.0,
        height=170.0
    )
    response = await register(payload, db_session)
    assert response.status_code == 400
    import json
    body = json.loads(response.body.decode())
    assert "Password must be at least 6 characters." in body["errors"]
    assert "Username must be at least 3 characters." in body["errors"]

def test_register_validation_errors_mismatch(client):
    """Verify password mismatch validation via normal client."""
    response = client.post(
        "/auth/register",
        json={
            "email": "mismatch@example.com",
            "username": "mismatchuser",
            "full_name": "Mismatch User",
            "password": "Password123!",
            "confirm_password": "DifferentPassword!",
        }
    )
    assert response.status_code == 400
    assert "Passwords do not match." in response.json()["errors"]

def test_register_duplicate_username(client, test_user):
    """Verify duplicate username check returns error."""
    # Register with existing username (from test_user) but different email
    response = client.post(
        "/auth/register",
        json={
            "email": "uniqueemail@example.com",
            "username": test_user.username,
            "full_name": "Duplicate User",
            "password": "Password123!",
            "confirm_password": "Password123!",
        }
    )
    assert response.status_code == 400
    assert "This username is already taken." in response.json()["errors"]

def test_register_db_error(client):
    """Verify database SQLAlchemyError during registration is handled."""
    with patch("app.routes.create_user", side_effect=SQLAlchemyError("DB error")):
        response = client.post(
            "/auth/register",
            json={
                "email": "dberror@example.com",
                "username": "dberroruser",
                "full_name": "DB Error User",
                "password": "Password123!",
                "confirm_password": "Password123!",
            }
        )
        assert response.status_code == 500
        assert "An error occurred during registration." in response.json()["errors"][0]


# --- app/routes.py get_current_user and profile tests ---

@pytest.mark.asyncio
async def test_get_current_user_no_auth():
    """Verify HTTP 401 when X-User-ID header is missing."""
    mock_request = MagicMock()
    mock_request.headers.get.return_value = None
    mock_db = MagicMock()
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, mock_db)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Not authenticated"

@pytest.mark.asyncio
async def test_get_current_user_not_found(db_session):
    """Verify HTTP 401 when user does not exist."""
    mock_request = MagicMock()
    mock_request.headers.get.return_value = str(uuid.uuid4())
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, db_session)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "User not found or inactive"

@pytest.mark.asyncio
async def test_get_current_user_with_profile(db_session, test_user):
    """Verify profile data is parsed and returned correctly."""
    # Create profile for test user
    profile = PatientProfile(
        user_id=test_user.id,
        medical_conditions=["Condition A"],
        dietary_preferences=["Pref A"],
        blood_type="O+",
        emergency_contact="911"
    )
    db_session.add(profile)
    db_session.commit()

    mock_request = MagicMock()
    mock_request.headers.get.return_value = str(test_user.id)
    
    result = await get_current_user(mock_request, db_session)
    assert result["profile"] is not None
    assert result["profile"]["medical_conditions"] == ["Condition A"]
    assert result["profile"]["dietary_preferences"] == ["Pref A"]
    assert result["profile"]["blood_type"] == "O+"
    assert result["profile"]["emergency_contact"] == "911"


# --- app/services.py authenticate_user password check ---

def test_authenticate_user_no_password(db_session):
    """Verify user authentication fails if user does not have a hashed password."""
    # Create user with hashed_password = None (simulating SSO user)
    user = User(
        id=uuid.uuid4(),
        email="sso@example.com",
        username="ssouser",
        full_name="SSO User",
        hashed_password=None,
        auth_type="local",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()

    assert authenticate_user(db_session, "sso@example.com", "any_password") is None
