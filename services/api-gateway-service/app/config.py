"""
API Gateway - Configuration
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "NutriAI API Gateway"
    JWT_SECRET_KEY: str = "change-this-secret-key-in-production-32b"
    ALGORITHM: str = "HS256"

    # Downstream service URLs
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    DOCUMENT_SERVICE_URL: str = "http://localhost:8002"
    DIET_SERVICE_URL: str = "http://localhost:8003"
    HEALTH_SERVICE_URL: str = "http://localhost:8004"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:8005"
    PROFILE_SERVICE_URL: str = "http://localhost:8006"
    ADMIN_SERVICE_URL: str = "http://localhost:8007"

    # Database (for health check only)
    DATABASE_URL: str = "sqlite:///./test.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
