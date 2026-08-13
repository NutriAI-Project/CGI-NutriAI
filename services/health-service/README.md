# NutriAI — Health Tracker Service

The **Health Service** manages records of patient vital metrics and food log histories. It enables patients to log their daily weight, blood sugar levels (fasting and postprandial), and blood pressure (systolic and diastolic), as well as details about their meals (breakfast, lunch, dinner, snacks).

---

## 🏗️ Core Role & Functionality
1. **Vital Metrics Logger**: Records daily biometrics, blood sugar metrics, blood pressure readings, and notes in the database.
2. **Meal Logger**: Tracks meal types, food descriptions, and approximate calorie estimates.
3. **Data Aggregator**: Returns historical logs of vitals and meals for the user to plot progress graphs on the frontend.

---

## 🛠️ Technology Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
* **ORM & DB Connection**: [SQLAlchemy](https://www.sqlalchemy.org/) & [Psycopg2](https://www.psycopg.org/)
* **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)

---

## ⚙️ Configuration & Environment Variables

Variables are configured in [app/config.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-health-service/app/config.py):

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./test.db` | PostgreSQL connection URL. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *Empty* | Azure Application Insights SDK telemetry connection. |

---

## 🗄️ Database Models

Model details are in [app/models.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-health-service/app/models.py):

* **HealthLog**: Fields include user ID, logging date, weight, fasting blood sugar, postprandial blood sugar, systolic blood pressure, diastolic blood pressure, notes, and created timestamp.
* **MealLog**: Fields include user ID, meal date, meal type (`breakfast`, `lunch`, `dinner`, `snack`), list of food items (JSON format), calorie estimates, notes, and created timestamp.

---

## 🔌 API Endpoints Reference

All routes are declared in [app/routes.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-health-service/app/routes.py).

| HTTP Method | Route | Description | Auth Header Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/health-tracker/data` | Returns historical health logs and meal logs for the patient. | `X-User-ID` |
| **POST** | `/health-tracker/log` | Logs weight, blood sugar, and blood pressure vitals. | `X-User-ID` |
| **POST** | `/health-tracker/meal` | Logs details of a meal consumed (breakfast, lunch, dinner, snack). | `X-User-ID` |

---

## 🔄 Integration & Routing

1. **Ingress Route**: Client web browsers send requests to `/api/health-tracker/*`.
2. **API Gateway Service**: Verifies the JWT cookie and forwards the request to the Health Service with the `X-User-ID` header.
3. **Database Sharing**: Writes to the shared PostgreSQL instance. Data written here is utilized by the Diet Service to customize AI diet plan generations.

---

## 🚀 CI/CD Pipeline
* Code triggers: [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-health-service/.github/workflows/cicd.yml).
* Uses reusable shared pipelines: format verification, unit testing, SonarQube quality gate and Snyk checks, Trivy container validation, push to ACR, and updates the manifests repository (`helm/nutriai/values-{env}.yaml`).

---

## 💻 Local Development

```bash
# Install packages
pip install -r requirements.txt

# Run health service locally (starts on port 8004)
uvicorn app.main:app --port 8004 --reload
```
Access at `http://127.0.0.1:8004`.
