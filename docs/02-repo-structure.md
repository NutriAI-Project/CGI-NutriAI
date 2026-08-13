# Repository Structure

```
CGI-NutriAI/
├── services/                        # every microservice's source, unmodified from its original repo
│   ├── auth-service/                #   FastAPI, Dockerfile included
│   ├── profile-service/
│   ├── diet-service/
│   ├── health-service/
│   ├── document-service/
│   ├── notification-service/
│   ├── admin-service/
│   ├── api-gateway-service/
│   └── frontend-service/            #   React/Vite + nginx
│
├── helm/nutriai/                    # THE single source of truth for all K8s manifests
│   ├── Chart.yaml
│   ├── values.yaml                  #   base defaults (all 9 services, ports, resources, HPA)
│   ├── values-prod.yaml             #   prod overlay (namespace, image tags, ExternalSecrets on)
│   ├── values-dev.yaml               #   dev overlay
│   ├── values-secrets.example.yaml  #   TEMPLATE — copy to values-secrets.yaml (git-ignored) for local demo
│   └── templates/                   #   Deployment/Service/ConfigMap/Secret/HPA/PDB/PVC/
│                                     #   StorageClass/Postgres/backup CronJob/Gateway/HTTPRoute — one
│                                     #   templated file per resource *kind*, looping over `values.services`
│
├── argocd/                          # GitOps: App-of-Apps
│   ├── projects/nutriai-project.yaml
│   ├── bootstrap/root-app.yaml      #   the ONE manifest you kubectl apply manually
│   ├── apps/nutriai-prod.yaml       #   child Application (enabled by default)
│   ├── apps-optional/nutriai-dev.yaml
│   └── secretstore.yaml             #   ExternalSecrets ClusterSecretStore (cluster infra, not app config)
│
├── .github/workflows/
│   ├── _reusable-build-push.yml     #   clone → build → push to ECR → bump Helm tag (GitOps commit)
│   └── ci-<service>.yml             #   x9, thin callers triggered by `<service>-vX.Y.Z` git tags
│
├── scripts/                         # one-time AWS bootstrap — NOT run automatically, see docs/03
│   ├── 01-create-ecr-repos.sh
│   ├── 02-setup-github-oidc-role.sh
│   └── 03-install-cluster-addons.sh
│
└── docs/                            # you are here
```

## Why manifests live only in `helm/`

The original per-service repos each shipped their own `Dockerfile`, and the
org's `NutriAI-manifests` repo kept a separate unified Helm chart for AKS.
Rather than maintaining raw `k8s/*.yaml` *and* a parallel Helm chart (the
old layout), this repo treats the Helm templates as the only manifest
source — they render straight to valid Kubernetes YAML via `helm template`
(see [07-helm-charts.md](07-helm-charts.md)) if you ever need static files
for manual `kubectl apply` or review. One source of truth, no drift between
"the real manifests" and "the Helm copy of the manifests".
