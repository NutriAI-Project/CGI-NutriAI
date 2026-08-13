"""
Notification Service - Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "NutriAI Notification Service"
    DATABASE_URL: str = "sqlite:///./test.db"

    # Service Bus — connection string takes priority (local dev / fallback)
    # In production (AKS), leave blank and set AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE instead.
    AZURE_SERVICE_BUS_CONNECTION_STRING: str = ""
    AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE: str = ""  # e.g. "nutriai-sb-prod.servicebus.windows.net"
    AZURE_SERVICE_BUS_TOPIC_NAME: str = "email-notifications"
    AZURE_SERVICE_BUS_SUBSCRIPTION_NAME: str = "email-sender"

    EMAIL_PROVIDER: str = "smtp"  # "smtp" or "sendgrid"

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@nutriai-health.com"

    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@nutriai-health.com"

    APP_URL: str = "http://localhost:3000"

    APPLICATIONINSIGHTS_CONNECTION_STRING: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()
