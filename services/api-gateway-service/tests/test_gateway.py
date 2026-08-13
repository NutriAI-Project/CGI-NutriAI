import pytest
import jwt
import httpx
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app, is_public_path, decode_jwt, lifespan
from app.config import get_settings

settings = get_settings()

def test_is_public_path():
    assert is_public_path("/auth/login") is True
    assert is_public_path("/health") is True
    assert is_public_path("/documents/list") is False

def test_decode_jwt_success():
    payload = {"sub": "12345", "role": "patient"}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    decoded = decode_jwt(token)
    assert decoded["sub"] == "12345"
    assert decoded["role"] == "patient"

def test_decode_jwt_failure():
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as excinfo:
        decode_jwt("invalid-token")
    assert excinfo.value.status_code == 401

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "api-gateway"

    response_api = client.get("/api/health")
    assert response_api.status_code == 200

@pytest.mark.asyncio
async def test_lifespan():
    mock_app = MagicMock()
    async with lifespan(mock_app):
        assert isinstance(mock_app.state.http_client, httpx.AsyncClient)
    assert mock_app.state.http_client.is_closed is True

@pytest.mark.asyncio
async def test_health_all_success(client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "healthy", "service": "mock"}

    async def mock_get(*args, **kwargs):
        return mock_response

    # Temporarily mock the app's http_client get method
    app.state.http_client = AsyncMock()
    app.state.http_client.get = mock_get

    # Call /health/all
    response = client.get("/health/all")
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "healthy"
    assert data["services"]["auth-service"]["status"] == "healthy"

@pytest.mark.asyncio
async def test_health_all_failures(client):
    app.state.http_client = AsyncMock()
    
    # We want to simulate some services returning non-200, some raising Timeout/ConnectError
    call_idx = 0
    async def mock_get(*args, **kwargs):
        nonlocal call_idx
        call_idx += 1
        if call_idx == 1:
            # First mock service: non-200
            resp = MagicMock()
            resp.status_code = 500
            return resp
        elif call_idx == 2:
            # Second mock service: Timeout
            raise httpx.TimeoutException("Timeout")
        else:
            # Others: ConnectError
            raise httpx.ConnectError("ConnectError")

    app.state.http_client.get = mock_get

    response = client.get("/health/all")
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "degraded"
    assert "unhealthy" in data["services"]["auth-service"]["status"]
    assert "unreachable" in data["services"]["document-service"]["status"]

@pytest.mark.asyncio
async def test_proxy_not_found(client):
    response = client.get("/nonexistent-prefix/route")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_proxy_public_path(client):
    app.state.http_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"success"
    mock_response.headers = {"content-type": "text/plain", "custom-header": "test", "transfer-encoding": "chunked"}
    app.state.http_client.request = AsyncMock(return_value=mock_response)

    response = client.post("/auth/login", content="credentials")
    assert response.status_code == 200
    assert response.text == "success"
    assert response.headers.get("custom-header") == "test"
    # Verify hop-by-hop headers removed
    assert "transfer-encoding" not in response.headers

@pytest.mark.asyncio
async def test_proxy_protected_unauthenticated(client):
    response = client.get("/documents/list")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_proxy_protected_invalid_token(client):
    client.cookies.set("access_token", "invalid-token")
    response = client.get("/documents/list")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_proxy_protected_missing_sub(client):
    payload = {"role": "patient"} # missing sub
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    client.cookies.set("access_token", token)
    response = client.get("/documents/list")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_proxy_protected_success(client):
    app.state.http_client = AsyncMock()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"data"
    mock_response.headers = {"content-type": "text/plain"}
    app.state.http_client.request = AsyncMock(return_value=mock_response)

    payload = {"sub": "user-123", "role": "patient"}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    client.cookies.set("access_token", token)

    response = client.get("/api/documents/list?query=1")
    assert response.status_code == 200
    assert response.text == "data"
    
    # Verify the client called with correct X-User-ID and X-User-Role headers
    called_kwargs = app.state.http_client.request.call_args[1]
    assert called_kwargs["headers"]["X-User-ID"] == "user-123"
    assert called_kwargs["headers"]["X-User-Role"] == "patient"

@pytest.mark.asyncio
async def test_proxy_unreachable(client):
    app.state.http_client = AsyncMock()
    app.state.http_client.request = AsyncMock(side_effect=httpx.ConnectError("Unreachable"))

    payload = {"sub": "user-123", "role": "patient"}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    client.cookies.set("access_token", token)

    response = client.get("/documents/list")
    assert response.status_code == 503

@pytest.mark.asyncio
async def test_proxy_timeout(client):
    app.state.http_client = AsyncMock()
    app.state.http_client.request = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

    payload = {"sub": "user-123", "role": "patient"}
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    client.cookies.set("access_token", token)

    response = client.get("/documents/list")
    assert response.status_code == 504

def test_proxy_api_root(client):
    response = client.get("/api")
    assert response.status_code == 404

