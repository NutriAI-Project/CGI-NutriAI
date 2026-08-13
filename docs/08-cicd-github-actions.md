# CI/CD — GitHub Actions (CI) → ArgoCD (CD)

## Pipeline shape

```
git tag auth-service-v1.2.4 && git push origin auth-service-v1.2.4
        │
        ▼
.github/workflows/ci-auth-service.yml   (resolves the tag, calls the reusable workflow)
        │
        ▼
.github/workflows/_reusable-build-push.yml
  1. Clone (checkout)
  2. Configure AWS creds — OIDC AssumeRoleWithWebIdentity, no static keys
  3. Build the Docker image from services/auth-service/Dockerfile
  4. Push to ECR: <account>.dkr.ecr.us-east-1.amazonaws.com/nutriai/auth-service:v1.2.4 (+ :latest)
  5. yq-patch helm/nutriai/values-prod.yaml → services.auth-service.image.tag = v1.2.4
  6. git commit + push that one-line change back to this repo (retries on race with `git pull --rebase`)
        │
        ▼
ArgoCD (watching main) shows nutriai-prod as OutOfSync
        │
        ▼
argocd app sync nutriai-prod   (manual — production, see docs/09)
        │
        ▼
Helm renders the new tag → rolling update in the cluster
```

## Triggering a build

Per-service, tag-triggered — exactly as asked ("triggering whenever we pass
the docker image tag"):

```bash
git tag auth-service-v1.0.0
git push origin auth-service-v1.0.0
```

Each service has its own tag namespace (`<service>-v*`) so tagging one
service never triggers a rebuild of the other eight. Manual trigger is
also available (`gh workflow run ci-auth-service.yml -f image_tag=v1.0.1
-f environment=prod`) for ad-hoc builds without a git tag.

> **Why not path-filtered `push: branches: [main]`?** GitHub ANDs a `paths`
> filter with a `tags` filter inside the same `push:` block — a tag pushed
> on a commit that doesn't touch that service's folder would silently *not*
> trigger the workflow. Kept the trigger to tags + manual dispatch only, to
> match exactly what was asked and avoid that footgun.

## Required GitHub configuration (one-time, per repo)

1. **`AWS_GITHUB_ACTIONS_ROLE_ARN`** secret — from
   [03-aws-bootstrap.md](03-aws-bootstrap.md) §3
   (`scripts/02-setup-github-oidc-role.sh`). No AWS access key/secret ever
   touches GitHub Secrets.
2. Actions permissions: **Settings → Actions → General → Workflow
   permissions → Read and write permissions** (needed for the GitOps tag-bump
   commit step in `_reusable-build-push.yml`).
3. Optional environment protection: create GitHub **Environments** named
   `prod` and `dev` (Settings → Environments) and add required reviewers on
   `prod` if you want a manual approval gate before any image reaches ECR
   for a production tag — the reusable workflow already references
   `environment: ${{ inputs.environment }}`, so this "just works" once the
   Environments exist.

## Adding a 10th service later

1. `services/<new-service>/` with its own `Dockerfile`
2. Add its block to `helm/nutriai/values.yaml` → `services:`
3. Copy `.github/workflows/ci-auth-service.yml` → `ci-<new-service>.yml`,
   swap the service name (3 occurrences)
4. `scripts/01-create-ecr-repos.sh` picks it up if you add it to the
   `SERVICES` array, or create the ECR repo manually — the reusable
   workflow also self-creates it on first push if missing

## Local equivalent (no GitHub Actions, testing a build locally)

```bash
cd services/auth-service
cp .env.example .env   # fill in real local values
docker build -t nutriai/auth-service:local-test .
docker run --rm -p 8001:8001 --env-file .env nutriai/auth-service:local-test
curl http://localhost:8001/health
```
