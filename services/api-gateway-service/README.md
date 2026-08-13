# NutriAI — API Gateway Service

The **API Gateway Service** serves as the central reverse proxy and entry point for all API requests routing into the NutriAI microservices cluster. It coordinates authentication validations, aggregates health statuses, manages CORS configurations, and securely forwards user context downstream.

---

## 🏗️ Role & Key Features
1. **Request Proxying**: Strips the `/api` routing prefix (added by Ingress/AGIC) and forwards the remaining request path to the appropriate downstream microservice using `httpx`.
2. **Session Authentication**: Intercepts requests for protected paths and checks for the presence of the HTTP-only `access_token` JWT cookie. Decodes the token using a shared secret and validates expiry.
3. **Context Propagation**: Extracts user identification (`sub` UUID) and authorization credentials (`role` string) from the decoded JWT payload and appends them as headers (`X-User-ID` and `X-User-Role`) before forwarding requests downstream.
4. **Public Bypass**: Excludes core routes (e.g., login, registration, SSO callbacks, and health endpoints) from authentication checks.
5. **Telemetry Aggregator**: Connects to and audits downstream service connectivity.

---

## 🛠️ Technology Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
* **HTTP Client**: [httpx](https://www.python-httpx.org/) (AsyncClient for high-concurrency request forwarding)
* **JWT Decoder**: [PyJWT](https://pyjwt.readthedocs.io/)
* **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)

---

## ⚙️ Configuration & Environment Variables

Variables are loaded in [app/config.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-api-gateway-service/app/config.py):

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `JWT_SECRET_KEY` | `change-this-secret-key-in-production-32b` | 32-byte secret key used to verify user tokens. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `DATABASE_URL` | `sqlite:///./test.db` | Sqlite/Postgres connection string (only used for basic readiness checking). |
| `AUTH_SERVICE_URL` | `http://localhost:8001` | Downstream connection URL for Auth Service. |
| `DOCUMENT_SERVICE_URL` | `http://localhost:8002` | Downstream connection URL for Document Service. |
| `DIET_SERVICE_URL` | `http://localhost:8003` | Downstream connection URL for Diet Service. |
| `HEALTH_SERVICE_URL` | `http://localhost:8004` | Downstream connection URL for Health Service. |
| `NOTIFICATION_SERVICE_URL` | `http://localhost:8005` | Downstream connection URL for Notification Service. |
| `PROFILE_SERVICE_URL` | `http://localhost:8006` | Downstream connection URL for Profile Service. |
| `ADMIN_SERVICE_URL` | `http://localhost:8007` | Downstream connection URL for Admin Service. |

---

## 🚦 Routing Architecture

### Public Routes (Bypasses JWT Check)
The following endpoints defined in [app/main.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-api-gateway-service/app/main.py#L26) do not require a session token:
* `/auth/login`
* `/auth/register`
* `/auth/microsoft`
* `/auth/callback`
* `/auth/forgot-password`
* `/health`
* `/health/all`

### Protected Routes (Requires valid JWT cookie)
The Gateway checks for the cookie `access_token` on all other routes. If missing or invalid, it returns `401 Unauthorized`. If valid, it decodes the JWT and maps the routes as follows:

| Path Prefix | Target Service | Downstream Header Added |
| :--- | :--- | :--- |
| `/auth/*` | Auth Service | `X-User-ID`, `X-User-Role` (where applicable) |
| `/documents/*` | Document Service | `X-User-ID`, `X-User-Role` |
| `/diet-plan/*` | Diet Service | `X-User-ID`, `X-User-Role` |
| `/health-tracker/*` | Health Service | `X-User-ID`, `X-User-Role` |
| `/notifications/*` | Notification Service | `X-User-ID`, `X-User-Role` |
| `/profile/*` | Profile Service | `X-User-ID`, `X-User-Role` |
| `/admin/*` | Admin Service | `X-User-ID`, `X-User-Role` (must be `admin`) |

---

## 🔌 Core Gateway Routes

* **`GET /health`**: Returns basic gateway health status.
* **`GET /health/all`**: Aggregates and returns the status of the gateway plus health responses from all 7 downstream microservices. If any service is unreachable or errors, returns `overall_status: degraded`.
* **`ANY /{path}`**: Catches and proxies all other requests matching the prefix list downstream.

---

## 🚀 CI/CD Pipeline

The CI/CD pipeline is declared in [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-api-gateway-service/.github/workflows/cicd.yml).

* Uses the reusable [ci.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-reusable-workflows/.github/workflows/ci.yml) and [helm-updater.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-reusable-workflows/.github/workflows/helm-updater.yml) workflows.
* Triggers unit tests, SonarQube quality gate checks, Snyk vulnerability scans, Trivy image scans, container pushes to ACR, and updates the manifests repository (`helm/nutriai/values-{env}.yaml`).

---

## 💻 Local Development

### Startup Commands
```bash
# Install dependencies
pip install -r requirements.txt

# Run gateway locally (starts on port 8000)
uvicorn app.main:app --port 8000 --reload
```
The Gateway is now accessible at `http://127.0.0.1:8000`. Note that downstream microservices must be running at their configured ports in `config.py` for proxy routing to succeed.
