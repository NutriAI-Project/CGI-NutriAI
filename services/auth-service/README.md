# NutriAI — Auth Service

The **Auth Service** manages user identity, account registrations, session tokens (JWTs), and credentials validation. It supports both classic email/password authentication and Single Sign-On (SSO) federated login via **Microsoft Entra ID**.

---

## 🏗️ Core Role & Functionality
1. **Local Authentication**: Validates user credentials. Registers users with password hashing using `bcrypt`.
2. **Microsoft Entra ID SSO**: Integrates with Entra ID via `msal` to fetch tenant authentication tokens. Matches SSO users against local user schemas or creates them dynamically on first login.
3. **Session Management**: Issues JWT access tokens on login and sets them as secure, HTTP-only `access_token` cookies.
4. **User Verification**: Decodes JWT headers (sent as downstream HTTP headers from the API Gateway) to return profile metadata.

---

## 🛠️ Technology Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
* **SSO Integrator**: [MSAL (Microsoft Authentication Library for Python)](https://github.com/AzureAD/microsoft-authentication-library-for-python)
* **Crypto & Hashing**: [bcrypt](https://github.com/pyca/bcrypt/) & [passlib](https://passlib.readthedocs.io/)
* **Token Issuer**: [PyJWT](https://pyjwt.readthedocs.io/)
* **ORM & DB Connection**: [SQLAlchemy](https://www.sqlalchemy.org/) & [Psycopg2](https://www.psycopg.org/)

---

## ⚙️ Configuration & Environment Variables

Variables are configured in [app/config.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-auth-service/app/config.py):

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `JWT_SECRET_KEY` | `change-this-secret-key-in-production-32bytes` | JWT signature encryption secret. |
| `ALGORITHM` | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Duration (minutes) before JWT tokens expire. |
| `DATABASE_URL` | `sqlite:///./test.db` | PostgreSQL database connection string. |
| `ENTRA_CLIENT_ID` | *Empty* | Azure Entra ID Application (Client) ID. |
| `ENTRA_CLIENT_SECRET` | *Empty* | Azure Entra ID Client secret. |
| `ENTRA_TENANT_ID` | *Empty* | Azure Entra ID Directory (Tenant) ID. |
| `ENTRA_REDIRECT_URI` | `http://localhost:8000/auth/callback` | Callback URL registered with Azure Portal. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *Empty* | Azure Application Insights SDK telemetry connection. |

---

## 🗄️ Database Schema & Models

The service uses the models in [app/models.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-auth-service/app/models.py):

* **User**: Base model storing email, username, full name, age, height, weight, auth type (`local` or `entra`), and Entra Object ID (`entra_oid`).
* **PatientProfile**: Linked 1-to-1 with `User`. Holds list fields for medical conditions, dietary preferences, blood type, and emergency contacts.
* **FoodAllergy**: Linked many-to-1 with `User`. Tracks patient allergens, severity metrics (`mild`, `moderate`, `severe`), and specific clinical notes.

---

## 🔌 API Endpoints Reference

All endpoints are declared in [app/routes.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-auth-service/app/routes.py).

| HTTP Method | Route | Description | Auth Requirement |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/register` | Registers a new user and sets a session JWT cookie. | Public |
| **POST** | `/auth/login` | Authenticates email/password, issues JWT cookie. | Public |
| **GET** | `/auth/microsoft` | Generates and returns the Entra ID authorization code login URL. | Public |
| **GET** | `/auth/callback` | Redirect landing for Entra ID. Extracts code, fetches tokens, registers user if new, sets JWT, and redirects to frontend. | Public |
| **GET** | `/auth/logout` | Clears the `access_token` JWT cookie. | Public |
| **GET** | `/auth/me` | Returns current user details. | Requires Gateway `X-User-ID` header |
| **GET** | `/auth/forgot-password` | Exposes password reset workflow endpoint. | Public |

---

## 🚀 CI/CD Pipeline
* CI/CD triggers are written in [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-auth-service/.github/workflows/cicd.yml).
* Uses reusable shared pipelines: checks format, runs tests/coverage, executes SonarQube quality gate and Snyk security scans, builds container, runs Trivy vulnerability validation, pushes to ACR, and updates the manifests repository (`helm/nutriai/values-{env}.yaml`).

---

## 💻 Local Development

```bash
# Install packages
pip install -r requirements.txt

# Run auth service locally (starts on port 8001)
uvicorn app.main:app --port 8001 --reload
```
Access at `http://127.0.0.1:8001`.
