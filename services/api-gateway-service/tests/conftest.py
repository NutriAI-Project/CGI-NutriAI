import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    # Use with statement to trigger lifespan startup and shutdown events
    with TestClient(app) as test_client:
        yield test_client
