"""
NutriAI Notification Service - Main Application
Includes background Service Bus consumer task.
"""
import asyncio
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, check_db_health
from app.routes import router
from app.services import service_bus_consumer
from sqlalchemy.exc import SQLAlchemyError

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Notification Service starting...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")
    except SQLAlchemyError as e:
        logger.warning(f"Database table creation check encountered an error (tables may already exist): {e}")

    # Start Service Bus consumer as background task
    consumer_task = asyncio.create_task(service_bus_consumer())
    logger.info("Service Bus consumer task started")

    yield

    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        logger.info("Service Bus consumer task was successfully cancelled.")
        raise
    logger.info("Notification Service shutting down...")


app = FastAPI(title="NutriAI Notification Service", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health")
async def health():
    db_ok = check_db_health()
    return {
        "service": "notification-service",
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8005, reload=True)
