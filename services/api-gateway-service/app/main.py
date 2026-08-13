"""
NutriAI API Gateway - Main Application
Validates JWT cookies, extracts user identity, and forwards requests
to downstream microservices with X-User-ID and X-User-Role headers.
"""

import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import jwt
from jwt.exceptions import PyJWTError as JWTError

from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

# Paths that do NOT require JWT authentication
PUBLIC_PATHS = [
    "/auth/login",
    "/auth/register",
    "/auth/microsoft",
    "/auth/callback",
    "/auth/forgot-password",
    "/health",
    "/health/all",
]


def is_public_path(path: str) -> bool:
    """Check if a request path is public (no JWT required)."""
    for pub in PUBLIC_PATHS:
        if path == pub or path == f"/{pub}" or path.rstrip("/") == pub.rstrip("/"):
            return True
    return False


def decode_jwt(token: str) -> dict:
    """Decode and validate a JWT token. Returns payload or raises."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# Route mapping: prefix -> (service_url, strip_prefix)
ROUTE_MAP = {
    "/auth": (settings.AUTH_SERVICE_URL, ""),
    "/documents": (settings.DOCUMENT_SERVICE_URL, ""),
    "/diet-plan": (settings.DIET_SERVICE_URL, ""),
    "/health-tracker": (settings.HEALTH_SERVICE_URL, ""),
    "/notifications": (settings.NOTIFICATION_SERVICE_URL, ""),
    "/profile": (settings.PROFILE_SERVICE_URL, ""),
    "/admin": (settings.ADMIN_SERVICE_URL, ""),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API Gateway starting...")
    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0))
    yield
    await app.state.http_client.aclose()
    logger.info("API Gateway shutting down...")


app = FastAPI(
    title="NutriAI API Gateway",
    description="Central entry point for all NutriAI microservices",
    version="2.0.0",
    lifespan=lifespan,
)

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


@app.get("/api/health")
@app.get("/health")
async def health_check():
    """API Gateway health check."""
    return {
        "service": "api-gateway",
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health/all")
@app.get("/health/all")
async def health_all(request: Request):
    """Aggregate health checks from all downstream services."""
    client: httpx.AsyncClient = request.app.state.http_client
    services = {
        "api-gateway": {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()},
    }

    service_urls = {
        "auth-service": settings.AUTH_SERVICE_URL,
        "document-service": settings.DOCUMENT_SERVICE_URL,
        "diet-service": settings.DIET_SERVICE_URL,
        "health-service": settings.HEALTH_SERVICE_URL,
        "notification-service": settings.NOTIFICATION_SERVICE_URL,
        "profile-service": settings.PROFILE_SERVICE_URL,
        "admin-service": settings.ADMIN_SERVICE_URL,
    }

    for name, url in service_urls.items():
        try:
            resp = await client.get(f"{url}/health", timeout=5.0)
            if resp.status_code == 200:
                services[name] = resp.json()
            else:
                services[name] = {"status": "unhealthy", "error": f"HTTP {resp.status_code}"}
        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
            services[name] = {"status": "unreachable", "error": str(e)}

    overall = "healthy" if all(
        s.get("status") == "healthy" for s in services.values()
    ) else "degraded"

    return {"overall_status": overall, "services": services}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    """
    Main proxy handler. Validates JWT (for protected routes),
    determines the target service, and forwards the request.
    """
    request_path = f"/{path}"

    # Strip /api prefix if present (routed via Ingress/AGIC)
    if request_path.startswith("/api/"):
        request_path = request_path[4:]
    elif request_path == "/api":
        request_path = "/"

    # Determine target service
    target_url = None
    for prefix, (service_url, _) in ROUTE_MAP.items():
        if request_path.startswith(prefix):
            # Forward the full path to the service
            target_url = f"{service_url}{request_path}"
            break

    if not target_url:
        raise HTTPException(status_code=404, detail="Route not found")

    # JWT validation for protected paths
    user_id = None
    user_role = None

    if not is_public_path(request_path):
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="Authentication required")

        payload = decode_jwt(token)
        user_id = payload.get("sub")
        user_role = payload.get("role", "patient")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

    # Build forwarded headers
    headers = dict(request.headers)
    # Remove host header to avoid conflicts
    headers.pop("host", None)
    headers.pop("Host", None)

    if user_id:
        headers["X-User-ID"] = str(user_id)
    if user_role:
        headers["X-User-Role"] = str(user_role)

    # Forward cookies
    cookies = dict(request.cookies)

    # Read request body
    body = await request.body()

    # Build query string
    query_string = str(request.query_params)
    url = f"{target_url}{'?' + query_string if query_string else ''}"

    # Forward the request
    client: httpx.AsyncClient = request.app.state.http_client

    try:
        proxy_response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            cookies=cookies,
        )
    except httpx.ConnectError as e:
        logger.error(f"Service unreachable: {url} - {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    except httpx.TimeoutException as e:
        logger.error(f"Service timeout: {url} - {e}")
        raise HTTPException(status_code=504, detail="Service timeout")

    # Build response
    response = Response(
        content=proxy_response.content,
        status_code=proxy_response.status_code,
        media_type=proxy_response.headers.get("content-type"),
    )

    # Forward response headers (excluding hop-by-hop headers)
    excluded_headers = {"transfer-encoding", "connection", "keep-alive", "content-encoding", "content-length"}
    for key, value in proxy_response.headers.items():
        if key.lower() not in excluded_headers:
            response.headers[key] = value

    return response


if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
