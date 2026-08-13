# NutriAI — Frontend Service

The **Frontend Service** is the web portal interface for the NutriAI application. It provides dashboards for patients to manage their profiles, log daily health metrics (weight, blood sugar, blood pressure), log meals, upload medical files, view AI diet recommendations, and print PDF logs. It also includes dashboard views for platform administrators.

---

## 🛠️ Technology Stack
* **UI Library**: [React 18](https://react.dev/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **Routing**: [React Router DOM v6](https://reactrouter.com/)
* **CSS & Style Framework**: [Tailwind CSS](https://tailwindcss.com/)
* **State & Fetching**: [Axios](https://axios-http.com/)
* **Interactive Visualizations**: [Chart.js](https://www.chartjs.org/) & [React ChartJS 2](https://react-chartjs-2.js.org/)
* **Micro-Animations**: [Framer Motion](https://www.framer.com/motion/)
* **File Drag-and-Drop**: [React Dropzone](https://react-dropzone.js.org/)
* **Production Web Server**: [Nginx](https://www.nginx.com/) (serves static production assets and proxies API calls)

---

## 🏗️ Folder Structure
* **/src**: Contains the React application logic.
  * **/components**: Reusable UI cards, tables, loading spinners, and layout headers.
  * **/pages**: Core page views (Login, Register, Dashboard, Documents, Health Tracker, Profile, Admin Panel).
  * **/utils**: API axios interceptors, date formatters, and data converters.
* **/static**: Legacy static assets and styling sheets.
* **/public**: Images, logos, and web manifest files.
* `nginx.conf.template`: Configuration template for running the Nginx server in production. Handles SPA fallback routing (`try_files`) and proxies `/api` to the gateway.

---

## 🔌 API Integrations

The frontend calls the backend microservices through the **API Gateway** using the prefix `/api/*`.

| Downstream Route | Backend Microservice Called | Purpose |
| :--- | :--- | :--- |
| `/api/auth/*` | Auth Service | Local login, registrations, and Entra ID SSO redirects. |
| `/api/profile/*` | Profile Service | Reading/updating medical histories and allergies. |
| `/api/documents/*` | Document Service | Fetching uploaded files, uploading PDF/images, deleting records. |
| `/api/diet-plan/*` | Diet Service | AI generation trigger, plan history, downloading PDF plans. |
| `/api/health-tracker/*` | Health Service | Fetching past graphs, logging vitals and meals. |
| `/api/notifications/*` | Notification Service | Fetching alert queues, marking notifications as read. |
| `/api/admin/*` | Admin Service | Auditing users and files (Admin role required). |

---

## 🚀 CI/CD Pipeline

The frontend pipeline is located in [.github/workflows/cicd.yml](file:///c:/Users/YASWANTH/cloudtrack_final/NutriAI-frontend-service/.github/workflows/cicd.yml). Since this is a Node.js project, it does not use the reusable Python workflow. Instead, it has a custom runner workflow that:

1. **Prepare**: Installs dependencies via `npm install` and resolves semantic image tags (`latest` or `dev-{sha}`).
2. **Test**: Runs automated unit tests and calculates test coverage using **Vitest**.
3. **SonarQube**: Conducts static code analysis with specific JavaScript exclusions.
4. **Snyk**: Runs security scans for dependencies in `package.json`.
5. **Build**: Packages React code into static distribution assets (`dist/`) and compiles a production Docker image using a multi-stage Dockerfile.
6. **Trivy**: Scans the compiled frontend image for OS and NPM package vulnerabilities.
7. **ACR Push**: Pushes the verified image to Azure Container Registry (ACR).
8. **GitHub Release**: Generates release notes and tags the repository on pushes to the `main` branch.
9. **Update Helm Values**: Clones the `NutriAI-manifests` repository and updates the image tags in `helm/nutriai/values-dev.yaml` or `values-prod.yaml` using `yq`.
10. **Notify**: Sends email updates regarding build statuses.

---

## 💻 Local Development

### Prerequisites
* Node.js (version 20 recommended)
* NPM

### Setup & Startup Commands
```bash
# 1. Install dependencies
npm install

# 2. Run the local development server (starts on port 5173)
npm run dev
```
Open `http://localhost:5173` in your browser. API requests will be proxied to the API Gateway at `http://localhost:8000` as configured in `vite.config.js`.

### Running Tests locally
```bash
# Run unit tests via Vitest
npm run test
```
