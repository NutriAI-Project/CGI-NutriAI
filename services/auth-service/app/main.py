"""
NutriAI Auth Service - Main Application
"""

import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine, check_db_health
from app.routes import router
from sqlalchemy.exc import SQLAlchemyError

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Auth Service starting...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")
        
        # Seed admin user
        from app.database import SessionLocal
        from app.models import User, PatientProfile
        from app.services import hash_password
        
        db = SessionLocal()
        try:
            admin_user = db.query(User).filter(User.email == "admin@nutriai-health.com").first()
            if not admin_user:
                logger.info("Seeding admin user data...")
                admin_user = User(
                    email="admin@nutriai-health.com",
                    username="admin",
                    hashed_password=hash_password("Password123!"),
                    full_name="Admin User",
                    role="admin",
                    auth_type="local",
                    is_active=True
                )
                db.add(admin_user)
                db.flush()
                
                profile = PatientProfile(
                    user_id=admin_user.id,
                    medical_conditions=[],
                    dietary_preferences=[],
                )
                db.add(profile)
                db.commit()
                logger.info("Admin user data seeded successfully.")
            else:
                logger.info("Admin user already exists. Skipping seeding.")
        except Exception as seed_err:
            logger.error(f"Error seeding admin user data: {seed_err}")
            db.rollback()
        finally:
            db.close()
            
    except SQLAlchemyError as e:
        logger.warning(f"Database table creation check encountered an error (tables may already exist): {e}")
    yield
    logger.info("Auth Service shutting down...")


app = FastAPI(title="NutriAI Auth Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://nutriai.buzz",
        "https://www.nutriai.buzz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    db_ok = check_db_health()
    return {
        "service": "auth-service",
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)

