# Kubernetes Manifests

All manifests are Helm templates under `helm/nutriai/templates/` (see
[02-repo-structure.md](02-repo-structure.md) for why there's no separate
static `k8s/` copy). This page documents what each template produces per
service, and the conventions applied everywhere.

## Per-service resources (one set of each, x9, via `range .Values.services`)

| Template | Produces | Notes |
|---|---|---|
| `deployment.yaml` | `Deployment` | RollingUpdate, `maxUnavailable: 0`, non-root user, all probes on `/health` (or `/` for frontend), `envFrom` ConfigMap+Secret |
| `service.yaml` | `Service` (ClusterIP) | never `LoadBalancer`/`NodePort` — only kgateway's own proxy Service is externally reachable |
| `configmap.yaml` | `ConfigMap` | non-secret env vars per `values.services.<name>.configEnv` |
| `secret.yaml` / `externalsecret.yaml` | `Secret` | native templated Secret (demo path) or `ExternalSecret` pulling from AWS Secrets Manager (prod path) — see [07-helm-charts.md](07-helm-charts.md) |
| `hpa.yaml` | `HorizontalPodAutoscaler` | CPU + memory target, per-service min/max in values |
| `pdb.yaml` | `PodDisruptionBudget` | `minAvailable: 1`, only for services with `maxReplicas > 1` |
| `pvc.yaml` | `PersistentVolumeClaim` | only for services with `pvc.enabled: true` (today: `document-service`) |
| `httproute.yaml` | `HTTPRoute` | path-based route to this service, see [06-gateway-routing.md](06-gateway-routing.md) |

## Cluster-scoped / shared resources

| Template | Produces |
|---|---|
| `namespace.yaml` | the `nutriai-prod` (or `-dev`) Namespace |
| `serviceaccount.yaml` | `nutriai-app-sa`, optionally IRSA-annotated |
| `storageclass.yaml` | `nutriai-gp3` (EBS), `nutriai-efs` (EFS), `nutriai-ebs-snapshot` (VolumeSnapshotClass) |
| `postgres.yaml` | `StatefulSet` + headless `Service` + credentials `Secret`, PVC via `volumeClaimTemplate` |
| `backup-cronjob.yaml` | nightly `pg_dump` `CronJob` + its own PVC |
| `gateway.yaml` | the kgateway `Gateway` resource |
| `networkpolicy.yaml` | default-deny ingress + allow-same-namespace |

## Security defaults applied everywhere

- `runAsNonRoot: true` (uid 1000 for Python services, 101 for the nginx
  frontend image, matching each Dockerfile's own `USER` directive)
- `allowPrivilegeEscalation: false`, capabilities dropped
- No `hostPath`, `hostNetwork`, or privileged containers anywhere
- `NetworkPolicy` default-denies cross-namespace ingress

## Resource requests/limits and HPA ranges

Set per-service in `helm/nutriai/values.yaml` — see the capacity budget
table in [01-architecture.md](01-architecture.md) before raising any
`maxReplicas`. To change a service's sizing:

```yaml
services:
  diet-service:
    resources:
      requests: {cpu: 100m, memory: 192Mi}
      limits: {cpu: 300m, memory: 384Mi}
    hpa:
      minReplicas: 1
      maxReplicas: 4
```

then `helm upgrade` (manual demo) or commit + let ArgoCD sync (GitOps) —
see [07-helm-charts.md](07-helm-charts.md).
