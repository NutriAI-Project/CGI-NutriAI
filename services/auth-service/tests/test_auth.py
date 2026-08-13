"""
NutriAI Auth Service - Comprehensive Tests
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

def test_health_endpoint(client):
    """Health check endpoint should return 200 and auth service identification."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "auth-service"


class TestLoginPage:
    """Tests for the login endpoint."""

    def test_login_with_valid_credentials(self, client, test_user):
        """Login with valid credentials should set cookie and return success."""
        response = client.post(
            "/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "TestPassword123!",
            }
        )
        assert response.status_code == 200
        assert "access_token" in response.cookies
        data = response.json()
        assert data["message"] == "Login successful"
        assert data["user"]["email"] == "testuser@example.com"

    def test_login_with_invalid_password(self, client, test_user):
        """Login with wrong password should return 401."""
        response = client.post(
            "/auth/login",
            json={
                "email": "testuser@example.com",
                "password": "WrongPassword!",
            }
        )
        assert response.status_code == 401
        assert "error" in response.json()

    def test_login_with_nonexistent_user(self, client):
        """Login with non-existent email should return 401."""
        response = client.post(
            "/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "SomePassword123!",
            }
        )
        assert response.status_code == 401
        assert "error" in response.json()


class TestRegistration:
    """Tests for user registration."""

    def test_register_with_valid_data(self, client):
        """Registration with valid data should create user and return 200."""
        response = client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "full_name": "New User",
                "password": "NewPassword123!",
                "confirm_password": "NewPassword123!",
                "age": 25,
                "gender": "female",
                "weight": 60.0,
                "height": 165.0
            }
        )
        assert response.status_code == 200
        assert "access_token" in response.cookies
        data = response.json()
        assert data["message"] == "Registration successful"
        assert data["user"]["email"] == "newuser@example.com"

    def test_register_duplicate_email(self, client, test_user):
        """Registration with existing email should return 400."""
        response = client.post(
            "/auth/register",
            json={
                "email": "testuser@example.com",
                "username": "anotheruser",
                "full_name": "Another User",
                "password": "Password123!",
                "confirm_password": "Password123!",
            }
        )
        assert response.status_code == 400
        assert "errors" in response.json()


class TestLogout:
    """Tests for the logout flow."""

    def test_logout_clears_cookie(self, authenticated_client):
        """Logout should clear the auth cookie and return success message."""
        response = authenticated_client.get("/auth/logout")
        assert response.status_code == 200
        assert "access_token" not in response.cookies or response.cookies.get("access_token") == ""
        assert response.json()["message"] == "Logged out successfully"


class TestMeRoute:
    """Tests for the /auth/me route."""

    def test_me_requires_header(self, client):
        """Accessing /auth/me without X-User-ID header should return 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401
        assert response.json()["detail"] == "Not authenticated"

    def test_me_accessible_with_header(self, client, test_user):
        """Accessing /auth/me with X-User-ID header should return user profile details."""
        response = client.get("/auth/me", headers={"X-User-ID": str(test_user.id)})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["id"] == str(test_user.id)


class TestForgotPassword:
    def test_forgot_password(self, client):
        response = client.get("/auth/forgot-password")
        assert response.status_code == 200
        assert "Password reset functionality" in response.json()["message"]


class TestMicrosoftSSO:
    @patch("app.routes.get_auth_url", return_value="https://login.microsoft.com/auth")
    def test_microsoft_login_success(self, mock_get_url, client):
        response = client.get("/auth/microsoft")
        assert response.status_code == 200
        assert response.json()["auth_url"] == "https://login.microsoft.com/auth"

    @patch("app.routes.get_auth_url", side_effect=ValueError("SSO error"))
    def test_microsoft_login_failure(self, mock_get_url, client):
        response = client.get("/auth/microsoft")
        assert response.status_code == 500


    def test_callback_with_error(self, client):
        response = client.get("/auth/callback?error=access_denied", follow_redirects=False)
        assert response.status_code == 307
        assert "/login?error=sso_denied" in response.headers["location"]

    def test_callback_missing_code(self, client):
        response = client.get("/auth/callback", follow_redirects=False)
        assert response.status_code == 307
        assert "/login?error=missing_code" in response.headers["location"]

    @patch("app.routes.acquire_token_by_code", return_value=None)
    def test_callback_token_fail(self, mock_acquire, client):
        response = client.get("/auth/callback?code=123", follow_redirects=False)
        assert response.status_code == 307
        assert "/login?error=token_failed" in response.headers["location"]

    @patch("app.routes.acquire_token_by_code", return_value={"id_token": "token"})
    @patch("app.routes.get_or_create_entra_user", return_value=(None, False))
    def test_callback_user_creation_fail(self, mock_get_user, mock_acquire, client):
        response = client.get("/auth/callback?code=123", follow_redirects=False)
        assert response.status_code == 307
        assert "/login?error=user_failed" in response.headers["location"]

    @patch("app.routes.acquire_token_by_code", return_value={"id_token": "token"})
    @patch("app.routes.get_or_create_entra_user")
    def test_callback_success(self, mock_get_user, mock_acquire, client, test_user):
        mock_get_user.return_value = (test_user, False)
        response = client.get("/auth/callback?code=123", follow_redirects=False)
        assert response.status_code == 307
        assert "/dashboard" in response.headers["location"]
        assert "access_token" in response.cookies

    @patch("app.routes.acquire_token_by_code", side_effect=OSError("Network failure"))
    def test_callback_exception(self, mock_acquire, client):
        response = client.get("/auth/callback?code=123", follow_redirects=False)
        assert response.status_code == 307
        assert "/login?error=sso_failed" in response.headers["location"]

    @patch("app.routes.acquire_token_by_code", return_value={"id_token": "token"})
    @patch("app.routes.get_or_create_entra_user")
    def test_callback_success_with_api_redirect_uri(self, mock_get_user, mock_acquire, client, test_user):
        mock_get_user.return_value = (test_user, False)
        from app.routes import settings
        original_uri = settings.ENTRA_REDIRECT_URI
        settings.ENTRA_REDIRECT_URI = "https://nutriai.buzz/api/auth/callback"
        try:
            response = client.get("/auth/callback?code=123", follow_redirects=False)
            assert response.status_code == 307
            assert "/dashboard" in response.headers["location"]
        finally:
            settings.ENTRA_REDIRECT_URI = original_uri


class TestAuthServices:
    def test_decode_access_token_invalid(self):
        from app.services import decode_access_token
        assert decode_access_token("invalid-jwt") is None

    def test_authenticate_user_wrong_auth_type(self, db_session, test_user):
        from app.services import authenticate_user
        test_user.auth_type = "entra_id"
        db_session.commit()
        assert authenticate_user(db_session, test_user.email, "TestPassword123!") is None

    def test_authenticate_user_inactive(self, db_session, test_user):
        from app.services import authenticate_user
        test_user.is_active = False
        db_session.commit()
        assert authenticate_user(db_session, test_user.email, "TestPassword123!") is None

    @patch("app.services.msal.ConfidentialClientApplication")
    def test_msal_helpers(self, mock_msal_class):
        from app.services import get_msal_app, get_auth_url, acquire_token_by_code
        mock_app = MagicMock()
        mock_msal_class.return_value = mock_app
        
        # Test get_msal_app
        app_inst = get_msal_app()
        assert app_inst == mock_app

        # Test get_auth_url
        mock_app.get_authorization_request_url.return_value = "https://login.microsoft.com"
        assert get_auth_url() == "https://login.microsoft.com"

        # Test acquire_token_by_code success
        mock_app.acquire_token_by_authorization_code.return_value = {"access_token": "sso-token"}
        assert acquire_token_by_code("code123") == {"access_token": "sso-token"}

        # Test acquire_token_by_code error in result
        mock_app.acquire_token_by_authorization_code.return_value = {"error": "invalid_grant", "error_description": "bad code"}
        assert acquire_token_by_code("code123") is None

        # Test acquire_token_by_code exception
        mock_app.acquire_token_by_authorization_code.side_effect = ValueError("MSAL Err")
        assert acquire_token_by_code("code123") is None

    def test_get_or_create_entra_user_missing_claims(self, db_session):
        from app.services import get_or_create_entra_user
        user, is_new = get_or_create_entra_user(db_session, {})
        assert user is None
        assert is_new is False

    def test_get_or_create_entra_user_existing_oid(self, db_session, test_user):
        from app.services import get_or_create_entra_user
        test_user.entra_oid = "oid-123"
        test_user.auth_type = "entra_id"
        db_session.commit()

        token_result = {"id_token_claims": {"oid": "oid-123", "preferred_username": test_user.email}}
        user, is_new = get_or_create_entra_user(db_session, token_result)
        assert user.id == test_user.id
        assert is_new is False

    def test_get_or_create_entra_user_existing_email(self, db_session, test_user):
        from app.services import get_or_create_entra_user
        test_user.entra_oid = None
        test_user.auth_type = "local"
        db_session.commit()

        token_result = {"id_token_claims": {"oid": "oid-456", "preferred_username": test_user.email}}
        user, is_new = get_or_create_entra_user(db_session, token_result)
        assert user.id == test_user.id
        assert user.entra_oid == "oid-456"
        assert user.auth_type == "entra_id"
        assert is_new is False

    def test_get_or_create_entra_user_new_user(self, db_session):
        from app.services import get_or_create_entra_user
        token_result = {
            "id_token_claims": {
                "oid": "oid-999",
                "preferred_username": "new_sso@example.com",
                "name": "SSO New User"
            }
        }
        user, is_new = get_or_create_entra_user(db_session, token_result)
        assert user is not None
        assert user.email == "new_sso@example.com"
        assert user.username == "new_sso"
        assert user.auth_type == "entra_id"
        assert is_new is True

        # Check duplicate username handling
        token_result_dup = {
            "id_token_claims": {
                "oid": "oid-888",
                "preferred_username": "new_sso@another.com",
                "name": "SSO Duplicate Username"
            }
        }
        user_dup, is_new_dup = get_or_create_entra_user(db_session, token_result_dup)
        assert user_dup is not None
        assert user_dup.username == "new_sso1"
        assert is_new_dup is True

    def test_get_or_create_entra_user_value_error(self):
        from app.services import get_or_create_entra_user
        mock_db = MagicMock()
        mock_db.query.side_effect = ValueError("Mocked Value Error")
        
        token_result = {"id_token_claims": {"oid": "oid-123", "preferred_username": "test@example.com"}}
        user, is_new = get_or_create_entra_user(mock_db, token_result)
        assert user is None
        assert is_new is False
        mock_db.rollback.assert_called_once()


