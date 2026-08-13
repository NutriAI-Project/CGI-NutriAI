# NutriAI — Notification Service

The **Notification Service** handles asynchronous communication inside the NutriAI portal. It subscribes to **Azure Service Bus** message queues, formats email templates, alerts patients about scheduled meals, and tracks the read/unread statuses of user alerts.

---

## 🏗️ Core Role & Functionality
1. **Asynchronous Subscription Consumer**: Runs an active background loop to listen to the `email-sender` subscription on the `email-notifications` Azure Service Bus topic.
2. **Email Delivery Dispatcher**: Supports sending HTML emails via standard **SMTP** (e.g. Gmail SMTP relay) or via the **SendGrid** API based on environment configurations.
3. **Template Engine**: Formats system templates (welcome alerts, weekly diet plans, and daily meal reminders) with dynamic patient data.
4. **Alerts Database Auditor**: Exposes endpoints for users to fetch past notifications and mark alerts as read.

---

## 🛠️ Technology Stack
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
* **Message Broker Client**: [Azure Service Bus SDK](https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/servicebus/azure-servicebus) (Async ServiceBusClient)
* **Email Client SDK**: [SendGrid SDK](https://github.com/sendgrid/sendgrid-python)
* **Auth Identity**: [Azure Identity SDK](https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/identity/azure-identity) (`DefaultAzureCredential`)
* **ORM & DB Connection**: [SQLAlchemy](https://www.sqlalchemy.org/) & [Psycopg2](https://www.psycopg.org/)

---

## ⚙️ Configuration & Environment Variables

Variables are configured in [app/config.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-notification-service/app/config.py):

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./test.db` | Shared PostgreSQL connection URL. |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | *Empty* | Service Bus connection string (local fallback). |
| `AZURE_SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE` | *Empty* | Service Bus host (e.g. `*.servicebus.windows.net`) used in production via Workload Identity. |
| `AZURE_SERVICE_BUS_TOPIC_NAME` | `email-notifications` | Service Bus topic. |
| `AZURE_SERVICE_BUS_SUBSCRIPTION_NAME` | `email-sender` | Subscription name to fetch from. |
| `EMAIL_PROVIDER` | `smtp` | Primary dispatcher target (`smtp` or `sendgrid`). |
| `SMTP_HOST` | `smtp.gmail.com` | Outbound SMTP server. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_USERNAME` | *Empty* | SMTP server username. |
| `SMTP_PASSWORD` | *Empty* | SMTP server password / app token. |
| `SMTP_FROM_EMAIL` | `noreply@nutriai-health.com` | Dispatcher sender address. |

---

## 🗄️ Database Models

Model details are in [app/models.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-notification-service/app/models.py):

* **Notification**: Fields include user ID, message text, notification type (`success`, `info`, `warning`, `danger`), FontAwesome icon class string, read status flag (`is_read`), email sent verification flag (`email_sent`), and creation timestamp.

---

## 🔌 API Endpoints Reference

All routes are declared in [app/routes.py](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-notification-service/app/routes.py).

| HTTP Method | Route | Description | Auth Header Required |
| :--- | :--- | :--- | :--- |
| **GET** | `/notifications/list` | Lists all past alerts and reminders for the patient. | `X-User-ID` |
| **POST** | `/notifications/{notification_id}/read`| Marks a specific alert message as read. | `X-User-ID` |
| **GET** | `/notifications/count` | Returns count of unread notifications. | `X-User-ID` |

---

## 🔄 Azure Service Bus & Worker Flow

1. **Publish Event**: The Diet Service publishes JSON payloads containing meal times, instructions, and user emails to the Service Bus topic.
2. **Listen Event**: The Notification Service background thread listens on the subscription queue. In AKS, connection is authenticated using **Workload Identity** (roles: `SB Data Receiver` and `SB Data Sender`).
3. **Email Formatting**: When a message lands:
   * Maps message schema into HTML using `build_meal_reminder_html` or `build_welcome_email_html`.
   * Sends the email via Sendgrid or SMTP.
   * Saves a notification instance to the database with `email_sent=True`, making it available on the frontend.

---

## 🚀 CI/CD Pipeline
* Code triggers: [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-notification-service/.github/workflows/cicd.yml).
* Uses reusable shared pipelines: format verification, unit testing, SonarQube quality gate and Snyk checks, Trivy container validation, push to ACR, and updates the manifests repository (`helm/nutriai/values-{env}.yaml`).

---

## 💻 Local Development

```bash
# Install packages
pip install -r requirements.txt

# Run notification service locally (starts on port 8005)
uvicorn app.main:app --port 8005 --reload
```
Access at `http://127.0.0.1:8005`.
