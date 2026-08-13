# Helm Charts — Install, Upgrade, Rollback

One umbrella chart, `helm/nutriai`, templates all 9 services + Postgres +
storage + gateway + backup from a single set of values files (see
[04-kubernetes-manifests.md](04-kubernetes-manifests.md) for what it
renders).

## 1. Values layering

```
values.yaml              # base defaults — ports, resources, HPA ranges, paths
  + values-prod.yaml      # OR values-dev.yaml — namespace, image tags, externalSecrets toggle
  + values-secrets.yaml   # git-ignored, LOCAL ONLY — real secret values for a manual demo install
```

`values-secrets.example.yaml` is the committed template — copy it once:

```bash
cd helm/nutriai
cp values-secrets.example.yaml values-secrets.yaml
# edit values-secrets.yaml with real values — this file is in .gitignore, never commit it
```

> **ArgoCD cannot see `values-secrets.yaml`** — it only renders files
> present in git. In the GitOps path, `values-prod.yaml` instead sets
> `externalSecrets.enabled: true`, which switches every service's `Secret`
> to an `ExternalSecret` sourced from AWS Secrets Manager. Set up ESO +
> the SecretStore first ([09-argocd-gitops.md](09-argocd-gitops.md) §3),
> or flip that flag back to `false` and `kubectl create secret` manually
> for a quick lab sync.

## 2. Manual install / upgrade (local demo, bypassing ArgoCD)

```bash
cd helm/nutriai
helm upgrade --install nutriai . \
  -f values.yaml -f values-prod.yaml -f values-secrets.yaml \
  -n nutriai-prod --create-namespace
```

Render without applying, to review first:

```bash
helm template nutriai . -f values.yaml -f values-prod.yaml -f values-secrets.yaml -n nutriai-prod | less
```

Lint:

```bash
helm lint . -f values.yaml -f values-prod.yaml -f values-secrets.yaml
```

## 3. Rollout

A normal `helm upgrade` (or an ArgoCD sync) performs a rolling update per
Deployment (`maxUnavailable: 0`, `maxSurge: 1` — zero-downtime, one extra
pod at a time). Watch it:

```bash
kubectl -n nutriai-prod rollout status deployment/auth-service
```

Bump just one service's image tag without touching anything else (this is
exactly what the CI pipeline automates — see
[08-cicd-github-actions.md](08-cicd-github-actions.md)):

```bash
helm upgrade nutriai . -f values.yaml -f values-prod.yaml -f values-secrets.yaml \
  -n nutriai-prod --set services.auth-service.image.tag=v1.2.4
```

## 4. Rollback

```bash
helm history nutriai -n nutriai-prod
helm rollback nutriai <REVISION> -n nutriai-prod
```

Under ArgoCD/GitOps, prefer reverting the git commit instead (keeps git as
the single source of truth):

```bash
git revert <bad-commit-sha>
git push
argocd app sync nutriai-prod    # prod requires a manual sync, see docs/09
```

## 5. Common `--set` overrides

```bash
# Scale a service's HPA ceiling
--set services.diet-service.hpa.maxReplicas=4

# Point at a different EFS filesystem
--set storage.efsFileSystemId=fs-0123456789abcdef0

# Switch a service's replicas manually (HPA will fight this — prefer hpa.minReplicas)
--set services.frontend-service.replicas=2
```

## 6. Rendering static manifests (if you want plain YAML for review/manual apply)

```bash
helm template nutriai . -f values.yaml -f values-prod.yaml -f values-secrets.yaml -n nutriai-prod > /tmp/nutriai-rendered.yaml
kubectl apply -f /tmp/nutriai-rendered.yaml   # bypasses Helm/ArgoCD release tracking — for one-off review only
```
