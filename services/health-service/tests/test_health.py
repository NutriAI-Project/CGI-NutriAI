import uuid
import pytest
from datetime import date
from sqlalchemy.exc import SQLAlchemyError
from unittest.mock import patch

from app.models import HealthLog, MealLog
from app.database import check_db_health

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "health-service"
    assert data["status"] == "healthy"

def test_check_db_health():
    assert check_db_health() is True
    with patch("app.database.engine.connect", side_effect=SQLAlchemyError("DB error")):
        assert check_db_health() is False

def test_chart_data_unauthenticated(client):
    response = client.get("/health-tracker/data")
    assert response.status_code == 401

def test_chart_data_empty(authenticated_client):
    response = authenticated_client.get("/health-tracker/data")
    assert response.status_code == 200
    data = response.json()
    assert "chart_data" in data
    assert "health_logs" in data
    assert "meal_logs" in data
    assert len(data["health_logs"]) == 0
    assert len(data["meal_logs"]) == 0

def test_chart_data_with_logs(authenticated_client, db_session, test_user_id):
    # Insert logs
    user_uuid = uuid.UUID(test_user_id)
    health = HealthLog(
        user_id=user_uuid,
        log_date=date.today(),
        weight=70.5,
        blood_sugar_fasting=95.0,
        blood_sugar_postprandial=120.0,
        blood_pressure_systolic=120,
        blood_pressure_diastolic=80,
        notes="Feeling great"
    )
    meal = MealLog(
        user_id=user_uuid,
        meal_date=date.today(),
        meal_type="breakfast",
        food_items=["Oatmeal", "Banana"],
        calories_estimate=350,
        notes="High fiber"
    )
    db_session.add(health)
    db_session.add(meal)
    db_session.commit()

    response = authenticated_client.get("/health-tracker/data")
    assert response.status_code == 200
    data = response.json()
    assert len(data["health_logs"]) == 1
    assert data["health_logs"][0]["weight"] == 70.5
    assert len(data["meal_logs"]) == 1
    assert data["meal_logs"][0]["meal_type"] == "breakfast"

def test_add_health_log_unauthenticated(client):
    response = client.post("/health-tracker/log", json={"log_date": "2026-06-21"})
    assert response.status_code == 401

def test_add_health_log_success(authenticated_client, db_session, test_user_id):
    payload = {
        "log_date": "2026-06-21",
        "weight": 70.5,
        "blood_sugar_fasting": 90.0,
        "blood_sugar_postprandial": 115.0,
        "blood_pressure_systolic": 118,
        "blood_pressure_diastolic": 78,
        "notes": "Test note"
    }
    response = authenticated_client.post("/health-tracker/log", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Health log saved successfully!"

    # Verify db
    logs = db_session.query(HealthLog).filter(HealthLog.user_id == uuid.UUID(test_user_id)).all()
    assert len(logs) == 1
    assert logs[0].weight == 70.5

def test_add_health_log_invalid_date(authenticated_client):
    payload = {"log_date": "invalid-date", "weight": 70.0}
    response = authenticated_client.post("/health-tracker/log", json=payload)
    assert response.status_code == 400
    assert "Invalid date format." in response.json()["error"]

def test_add_health_log_db_error(authenticated_client):
    payload = {"log_date": "2026-06-21", "weight": 70.0}
    with patch("app.routes.Session.commit", side_effect=SQLAlchemyError("DB Save Fail")):
        response = authenticated_client.post("/health-tracker/log", json=payload)
        assert response.status_code == 500
        assert "Failed to save health log." in response.json()["error"]

def test_add_meal_log_unauthenticated(client):
    response = client.post("/health-tracker/meal", json={"meal_date": "2026-06-21", "meal_type": "breakfast"})
    assert response.status_code == 401

def test_add_meal_log_success(authenticated_client, db_session, test_user_id):
    payload = {
        "meal_date": "2026-06-21",
        "meal_type": "breakfast",
        "food_items": "Oatmeal, Eggs, Toast",
        "calories_estimate": 450,
        "notes": "Yummy"
    }
    response = authenticated_client.post("/health-tracker/meal", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Meal log saved successfully!"

    # Verify db
    logs = db_session.query(MealLog).filter(MealLog.user_id == uuid.UUID(test_user_id)).all()
    assert len(logs) == 1
    assert logs[0].meal_type == "breakfast"
    assert logs[0].food_items == ["Oatmeal", "Eggs", "Toast"]

def test_add_meal_log_invalid_meal_type(authenticated_client):
    payload = {
        "meal_date": "2026-06-21",
        "meal_type": "brunch",
        "food_items": "Apples"
    }
    response = authenticated_client.post("/health-tracker/meal", json=payload)
    assert response.status_code == 400
    assert "Invalid meal type." in response.json()["error"]

def test_add_meal_log_invalid_date(authenticated_client):
    payload = {
        "meal_date": "invalid-date",
        "meal_type": "breakfast",
        "food_items": "Apples"
    }
    response = authenticated_client.post("/health-tracker/meal", json=payload)
    assert response.status_code == 400
    assert "Invalid date format." in response.json()["error"]

def test_add_meal_log_db_error(authenticated_client):
    payload = {
        "meal_date": "2026-06-21",
        "meal_type": "breakfast",
        "food_items": "Apples"
    }
    with patch("app.routes.Session.commit", side_effect=SQLAlchemyError("DB Save Fail")):
        response = authenticated_client.post("/health-tracker/meal", json=payload)
        assert response.status_code == 500
        assert "Failed to save meal log." in response.json()["error"]
