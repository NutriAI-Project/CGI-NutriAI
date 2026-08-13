# CGI-NutriAI

Unified monorepo for the NutriAI microservices platform — 8 FastAPI backend
services + 1 React/Vite frontend, deployed to AWS EKS via GitOps (ArgoCD
App-of-Apps), built by GitHub Actions CI, exposed through the Kubernetes
Gateway API (kgateway) with path-based routing, no LoadBalancer.

## What's here

| Path | What |
|---|---|
| [`services/`](services/) | source for all 9 microservices (unmodified from their original repos) |
| [`helm/nutriai/`](helm/nutriai/) | the single Helm chart that renders every Kubernetes manifest |
| [`argocd/`](argocd/) | App-of-Apps GitOps bootstrap |
| [`.github/workflows/`](.github/workflows/) | CI: clone → build → push to ECR → bump Helm tag |
| [`scripts/`](scripts/) | one-time AWS bootstrap (ECR, OIDC role, cluster add-ons) — not run automatically |
| [`docs/`](docs/) | full documentation, start at [`docs/10-runbook-end-to-end.md`](docs/10-runbook-end-to-end.md) |

## Quick start

New to this repo? Read in this order:

1. [docs/01-architecture.md](docs/01-architecture.md) — what gets deployed and why
2. [docs/03-aws-bootstrap.md](docs/03-aws-bootstrap.md) — one-time AWS setup
3. [docs/09-argocd-gitops.md](docs/09-argocd-gitops.md) — install & configure ArgoCD
4. [docs/08-cicd-github-actions.md](docs/08-cicd-github-actions.md) — how CI triggers on image tags
5. [docs/07-helm-charts.md](docs/07-helm-charts.md) — rollout/rollback/values reference
6. [docs/10-runbook-end-to-end.md](docs/10-runbook-end-to-end.md) — the whole thing, start to finish, one command at a time

## At a glance

```
git tag auth-service-v1.0.0 && git push origin auth-service-v1.0.0
        │  GitHub Actions: clone → build → push to ECR → bump helm/nutriai/values-prod.yaml
        ▼
ArgoCD (nutriai-prod, manual sync) renders the Helm chart and rolls out the new image
        │
        ▼
kgateway routes /auth-service/* to the new pods — reachable via bastion tunnel, see docs/06
```

No public LoadBalancer, no long-lived AWS keys in CI (OIDC), no secrets
committed to git (ExternalSecrets from AWS Secrets Manager by default).
Sized for a 2x t3.medium lab cluster — see the capacity budget in
[docs/01-architecture.md](docs/01-architecture.md) before scaling up.
