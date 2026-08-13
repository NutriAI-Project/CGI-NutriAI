# NutriAI — Admin Service

The **Admin Service** provides the administrative backend capabilities for the NutriAI platform. It exposes dashboards, statistics, and auditing capabilities for site administrators to manage user access and view document upload activities across the portal.

---

## 🛠️ Technology Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
* **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
* **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/)
* **Database Driver**: [Psycopg2](https://www.psycopg.org/) (for PostgreSQL)

---

## ⚙️ Configuration & Environment Variables

Configurations are managed in [app/config.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-admin-service/app/config.py) using `pydantic-settings`. The service expects the following environment variables:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./test.db` | PostgreSQL connection URL. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *Empty* | Connection string for Azure Application Insights (telemetry/tracing). |

---

## 🗄️ Database Models
The Admin Service references the global database schemas to read platform activities (defined in [app/models.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-admin-service/app/models.py)):

* **User**: Patient registration information (names, height, weight, status flags).
* **Document**: Metadata of files uploaded by patients (statuses, original names, blob URLs).
* **DietPlan**: Tracks histories of AI diet plans generated.
* **HealthLog**: Audit records of daily patient metrics (blood pressure, fasting sugar, weight changes).

---

## 🔌 API Endpoints Reference

All endpoints are defined in [app/routes.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-admin-service/app/routes.py).

| HTTP Method | Route | Description | Auth Requirement |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/dashboard` | Returns summary statistics (active users, uploads, plans). | Admin role check |
| **GET** | `/admin/users` | Lists all users registered on the platform. | Admin role check |
| **POST** | `/admin/users/{user_id}/toggle` | Activates or deactivates a user's account status. | Admin role check |
| **GET** | `/admin/documents` | Returns a list of all health records uploaded by patients. | Admin role check |

---

## 🔄 How it is Called & Integrated

1. **Ingress Route**: Client browsers send admin requests to `/api/admin/*`.
2. **API Gateway Service**: The API Gateway intercepts requests, verifies that the user has a valid session JWT cookie, and checks that the user's role is `admin`.
3. **Context Injection**: The Gateway forwards the request to the Admin Service with headers:
   * `X-User-ID`: The unique identifier of the admin.
   * `X-User-Role`: Must be `admin`.
4. **Local Response**: The Admin Service handles requests and queries the shared database to return management data.

---

## 🚀 CI/CD Pipeline

The CI/CD pipeline is declared in [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-admin-service/.github/workflows/cicd.yml).

1. **Continuous Integration (CI)**:
   * Uses the reusable [ci.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-reusable-workflows/.github/workflows/ci.yml) workflow in `NutriAI-reusable-workflows`.
   * Runs tests with coverage metrics.
   * Executes code security quality gate checks via **SonarQube**.
   * Checks requirements for known vulnerabilities using **Snyk**.
   * Builds the Docker image and runs a vulnerability report via **Trivy**.
   * Pushes the image to Azure Container Registry (ACR) on successful execution on `main` or `dev` branches.
2. **Continuous Delivery (CD)**:
   * Uses the reusable [helm-updater.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-reusable-workflows/.github/workflows/helm-updater.yml) workflow.
   * Modifies the container image tags dynamically inside `helm/nutriai/values-dev.yaml` (for dev branch) or `values-prod.yaml` (for main branch) in the `NutriAI-manifests` repository.

---

## 💻 Local Development

### 1. Requirements
* Python >= 3.12
* PostgreSQL or SQLite

### 2. Startup Commands
```bash
# Install dependencies
pip install -r requirements.txt

# Run the app locally
uvicorn app.main:app --port 8007 --reload
```
The service will launch at `http://127.0.0.1:8007`.
