import uuid
import pytest
from sqlalchemy.exc import SQLAlchemyError
from unittest.mock import patch, MagicMock

from app.models import Notification
from app.database import check_db_health
from app.services import (
    build_welcome_email_html,
    build_meal_reminder_html,
    send_email,
    service_bus_consumer
)

def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "notification-service"

def test_check_db_health():
    assert check_db_health() is True
    with patch("app.database.engine.connect", side_effect=SQLAlchemyError("DB error")):
        assert check_db_health() is False

def test_list_notifications_unauthenticated(client):
    response = client.get("/notifications/list")
    assert response.status_code == 401

def test_list_notifications_empty(authenticated_client):
    response = authenticated_client.get("/notifications/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data["notifications"]) == 0
    assert data["unread_count"] == 0

def test_list_notifications_with_data(authenticated_client, db_session, test_user_id):
    user_uuid = uuid.UUID(test_user_id)
    n1 = Notification(
        user_id=user_uuid,
        message="A test notification",
        type="success",
        is_read=False
    )
    n2 = Notification(
        user_id=user_uuid,
        message="Read notification",
        type="info",
        is_read=True
    )
    db_session.add(n1)
    db_session.add(n2)
    db_session.commit()

    response = authenticated_client.get("/notifications/list")
    assert response.status_code == 200
    data = response.json()
    assert len(data["notifications"]) == 2
    assert data["unread_count"] == 1

def test_mark_as_read_unauthenticated(client):
    fake_id = uuid.uuid4()
    response = client.post(f"/notifications/{fake_id}/read")
    assert response.status_code == 401

def test_mark_as_read_success(authenticated_client, db_session, test_user_id):
    user_uuid = uuid.UUID(test_user_id)
    notif = Notification(
        user_id=user_uuid,
        message="A test notification",
        type="success",
        is_read=False
    )
    db_session.add(notif)
    db_session.commit()

    response = authenticated_client.post(f"/notifications/{notif.id}/read")
    assert response.status_code == 200
    assert response.json()["message"] == "Notification marked as read."

    db_session.refresh(notif)
    assert notif.is_read is True

def test_mark_as_read_invalid_ids(authenticated_client):
    response = authenticated_client.post("/notifications/invalid-id/read")
    assert response.status_code == 400

def test_notification_count_unauthenticated(client):
    response = client.get("/notifications/count")
    assert response.status_code == 401

def test_notification_count_success(authenticated_client, db_session, test_user_id):
    user_uuid = uuid.UUID(test_user_id)
    n1 = Notification(
        user_id=user_uuid,
        message="Unread 1",
        is_read=False
    )
    n2 = Notification(
        user_id=user_uuid,
        message="Unread 2",
        is_read=False
    )
    n3 = Notification(
        user_id=user_uuid,
        message="Read 1",
        is_read=True
    )
    db_session.add_all([n1, n2, n3])
    db_session.commit()

    response = authenticated_client.get("/notifications/count")
    assert response.status_code == 200
    assert response.json()["count"] == 2

def test_email_builders():
    welcome_html = build_welcome_email_html({})
    assert "Welcome to NutriAI" in welcome_html

    reminder_data = {
        "meal_type": "Breakfast",
        "day_name": "Monday",
        "meal_description": "Oatmeal with almonds",
        "foods_to_eat": [{"food_name": "Oats", "portion_size": "1 cup", "timing": "Morning"}],
        "foods_to_avoid": [{"food_name": "Sugar", "reason": "Diabetes", "risk_level": "high"}]
    }
    reminder_html = build_meal_reminder_html(reminder_data)
    assert "breakfast" in reminder_html
    assert "Oats" in reminder_html
    assert "Sugar" in reminder_html

@patch("smtplib.SMTP")
def test_send_email(mock_smtp):
    mock_server = MagicMock()
    mock_smtp.return_value.__enter__.return_value = mock_server

    send_email("test@example.com", "Subject", "<h1>Test</h1>")
    assert mock_smtp.called
    assert mock_server.starttls.called
    assert mock_server.login.called
    assert mock_server.sendmail.called

@pytest.mark.asyncio
async def test_service_bus_consumer_disabled():
    with patch("app.services.settings.AZURE_SERVICE_BUS_CONNECTION_STRING", ""):
        await service_bus_consumer()

@pytest.mark.asyncio
async def test_service_bus_consumer_import_error():
    with patch("app.services.settings.AZURE_SERVICE_BUS_CONNECTION_STRING", "Endpoint=sb://test"), \
         patch("builtins.__import__", side_effect=ImportError("azure-servicebus")):
        await service_bus_consumer()

@pytest.mark.asyncio
async def test_service_bus_consumer_success(db_session):
    mock_client = MagicMock()
    mock_receiver = MagicMock()
    
    async def mock_async_enter_receiver(*args, **kwargs):
        return mock_receiver
    async def mock_async_exit_receiver(*args, **kwargs):
        pass
    mock_receiver.__aenter__ = mock_async_enter_receiver
    mock_receiver.__aexit__ = mock_async_exit_receiver
    
    async def mock_async_enter_client(*args, **kwargs):
        return mock_client
    async def mock_async_exit_client(*args, **kwargs):
        pass
    mock_client.__aenter__ = mock_async_enter_client
    mock_client.__aexit__ = mock_async_exit_client
    
    mock_client.get_subscription_receiver.return_value = mock_receiver
    
    mock_msg = MagicMock()
    mock_msg.__str__.return_value = '{"user_email": "test@example.com", "meal_type": "welcome", "user_id": "d0bd454d-fa7f-43dd-88e4-acae20ceb2d6"}'
    
    mock_msg_reminder = MagicMock()
    mock_msg_reminder.__str__.return_value = '{"user_email": "test@example.com", "meal_type": "breakfast", "day_name": "Monday", "user_id": "d0bd454d-fa7f-43dd-88e4-acae20ceb2d6"}'
    
    call_count = 0
    async def mock_receive_messages(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return [mock_msg, mock_msg_reminder]
        else:
            raise KeyboardInterrupt("Stop Loop")
            
    mock_receiver.receive_messages = mock_receive_messages
    
    async def mock_complete_message(*args, **kwargs):
        pass
    mock_receiver.complete_message = mock_complete_message
    
    async def mock_abandon_message(*args, **kwargs):
        pass
    mock_receiver.abandon_message = mock_abandon_message
    
    with patch("azure.servicebus.aio.ServiceBusClient.from_connection_string", return_value=mock_client), \
         patch("app.services.settings.AZURE_SERVICE_BUS_CONNECTION_STRING", "Endpoint=sb://test"), \
         patch("app.services.send_email") as mock_send:
        try:
            await service_bus_consumer()
        except KeyboardInterrupt:
            pass
        assert mock_send.call_count == 2
