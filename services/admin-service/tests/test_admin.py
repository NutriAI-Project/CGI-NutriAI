import uuid
import pytest
from sqlalchemy.exc import SQLAlchemyError
from unittest.mock import patch
from datetime import datetime

from app.models import User, Document, DietPlan, HealthLog
from app.database import check_db_health

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "admin-service"

def test_check_db_health():
    assert check_db_health() is True
    with patch("app.database.engine.connect", side_effect=SQLAlchemyError("DB error")):
        assert check_db_health() is False

def test_require_admin_unauthorized(client):
    response = client.get("/admin/dashboard")
    assert response.status_code == 403
    assert "Admin access required" in response.json()["detail"]

def test_admin_dashboard_success(authenticated_admin_client, db_session, test_admin_id):
    user_uuid = uuid.UUID(test_admin_id)
    # Populate some DB objects
    admin_user = User(id=user_uuid, email="admin@example.com", username="admin", full_name="Admin", role="admin", is_active=True)
    other_user = User(id=uuid.uuid4(), email="user@example.com", username="user", full_name="User", role="patient", is_active=False)
    doc = Document(id=uuid.uuid4(), user_id=other_user.id, original_filename="doc.pdf", ocr_status="completed")
    plan = DietPlan(id=uuid.uuid4(), user_id=other_user.id, plan_title="Test Plan")
    log = HealthLog(id=uuid.uuid4(), user_id=other_user.id, log_date=datetime.now())
    
    db_session.add_all([admin_user, other_user, doc, plan, log])
    db_session.commit()

    response = authenticated_admin_client.get("/admin/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_users"] == 2
    assert data["active_users"] == 1
    assert data["total_documents"] == 1
    assert data["total_diet_plans"] == 1
    assert data["total_health_logs"] == 1
    assert data["completed_ocr"] == 1
    assert data["admin_count"] == 1

def test_list_users(authenticated_admin_client, db_session):
    u = User(id=uuid.uuid4(), email="john@example.com", username="john", full_name="John", role="patient", is_active=True)
    db_session.add(u)
    db_session.commit()

    response = authenticated_admin_client.get("/admin/users")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(x["email"] == "john@example.com" for x in data)

def test_toggle_user_self(authenticated_admin_client, test_admin_id):
    response = authenticated_admin_client.post(f"/admin/users/{test_admin_id}/toggle")
    assert response.status_code == 400
    assert "Cannot deactivate your own account" in response.json()["error"]

def test_toggle_user_not_found(authenticated_admin_client):
    fake_id = uuid.uuid4()
    response = authenticated_admin_client.post(f"/admin/users/{fake_id}/toggle")
    assert response.status_code == 404
    assert "User not found" in response.json()["error"]

def test_toggle_user_success(authenticated_admin_client, db_session):
    target = User(id=uuid.uuid4(), email="target@example.com", username="target", full_name="Target", is_active=True)
    db_session.add(target)
    db_session.commit()

    response = authenticated_admin_client.post(f"/admin/users/{target.id}/toggle")
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    response2 = authenticated_admin_client.post(f"/admin/users/{target.id}/toggle")
    assert response2.status_code == 200
    assert response2.json()["is_active"] is True

def test_toggle_user_invalid_id(authenticated_admin_client):
    response = authenticated_admin_client.post("/admin/users/invalid-id/toggle")
    assert response.status_code == 400

def test_list_documents(authenticated_admin_client, db_session):
    u = User(id=uuid.uuid4(), email="john@example.com", username="john", full_name="John", role="patient", is_active=True)
    doc = Document(id=uuid.uuid4(), user_id=u.id, original_filename="report.pdf", document_type="lab_report", ocr_status="completed")
    db_session.add(u)
    db_session.add(doc)
    db_session.commit()

    response = authenticated_admin_client.get("/admin/documents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["username"] == "john"
    assert data[0]["original_filename"] == "report.pdf"
