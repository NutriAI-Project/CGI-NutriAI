# Architecture

## Platform

```
                         ┌─────────────────────────────────────────────┐
                         │                EKS cluster (us-east-1)       │
                         │        2x t3.medium worker nodes             │
                         │                                               │
   Browser/API client    │   ┌──────────────┐        ┌────────────────┐ │
   (via kubectl          │   │  kgateway     │        │  namespace:    │ │
   port-forward /        │   │  (Gateway API │──────▶│  nutriai-prod  │ │
   bastion tunnel —      │───│  controller,  │        │                │ │
   no public LB)         │   │  ClusterIP)   │        │  9 Deployments │ │
                         │   └──────────────┘        │  + HPA + PDB   │ │
                         │                             │  + postgres    │ │
                         │   ┌──────────────┐          │    StatefulSet │ │
                         │   │  ArgoCD       │◀─ syncs ─│  + backup     │ │
                         │   │  (namespace:  │  Helm    │    CronJob     │ │
                         │   │  argocd)      │  chart   └────────────────┘ │
                         │   └──────┬───────┘                              │
                         └──────────┼───────────────────────────────────────┘
                                    │ watches git (this repo, main branch)
                                    ▼
                         github.com/NutriAI16-ORG/CGI-NutriAI
                                    ▲
                                    │ CI pushes image + bumps values-prod.yaml
                         GitHub Actions (OIDC → ECR push)
```

## Services (all in `services/`, one Helm-templated Deployment+Service each)

| Service | Port | Path | Stack | DB | Notes |
|---|---|---|---|---|---|
| frontend-service | 80 | `/` | React/Vite + nginx | – | SPA, proxies `/api` to api-gateway in-cluster |
| api-gateway-service | 8000 | `/api` | FastAPI | health-check only | fronts the other 7 backend services |
| auth-service | 8001 | `/auth-service` | FastAPI | ✓ | JWT + Entra ID SSO |
| document-service | 8002 | `/document-service` | FastAPI | ✓ | uploads → RWX EFS PVC |
| diet-service | 8003 | `/diet-service` | FastAPI | ✓ | Azure OpenAI + Service Bus |
| health-service | 8004 | `/health-service` | FastAPI | ✓ | |
| notification-service | 8005 | `/notification-service` | FastAPI | ✓ | SMTP/SendGrid + Service Bus |
| profile-service | 8006 | `/profile-service` | FastAPI | ✓ | |
| admin-service | 8007 | `/admin-service` | FastAPI | ✓ | |

All 8 backend services share a single in-cluster PostgreSQL instance (see
[05-storage-and-backup.md](05-storage-and-backup.md)). Several services also
call external Azure APIs (OpenAI, Document Intelligence, Service Bus,
Entra ID) — those remain external to the AWS cluster; only compute and
storage move to EKS. This is a deliberate scope decision, not an oversight —
ask if you'd rather replace any of these with AWS-native equivalents
(Bedrock, SES, SQS, Cognito).

## Why no LoadBalancer

You asked for kgateway instead of a cloud LoadBalancer/Ingress. The Gateway
resource's own Envoy proxy Service defaults to `ClusterIP`
(`gateway.serviceType` in Helm values) — nothing provisions an AWS
NLB/ALB. Reach the app via `kubectl port-forward` (locally, or tunnelled
through the bastion host) — see
[06-gateway-routing.md](06-gateway-routing.md) for the exact commands and
the resulting test URL. A `NodePort` option is documented there too if you
want a stable address without a full LoadBalancer.

## Resource budget (2x t3.medium)

t3.medium = 2 vCPU / 4 GiB. Allocatable after EKS system reservations is
roughly **3.6 vCPU / 6.6 GiB total** across both nodes. Approximate steady-state
requests at `minReplicas`:

| Component | CPU req | Mem req |
|---|---|---|
| kube-system (coredns, kube-proxy, aws-node, CSI drivers, metrics-server) | ~500m | ~800Mi |
| ArgoCD (core install, no HA/Dex) | ~500m | ~800Mi |
| kgateway (control plane + 1 Envoy proxy) | ~250m | ~300Mi |
| PostgreSQL (1 replica) | 250m | 512Mi |
| 8 backend services (1 replica each, 75m/128Mi) | 600m | 1024Mi |
| frontend (1 replica) | 25m | 32Mi |
| **Total** | **~2.1 vCPU** | **~3.5 GiB** |

That leaves roughly 1.5 vCPU / 3 GiB of headroom for the HPAs to scale a
couple of services out under load. `helm/nutriai/values.yaml` keeps
`maxReplicas` at 2–3 per service deliberately — raise it once you've
confirmed real headroom with `kubectl top nodes`, or add a 3rd node.

## Environments

- **prod** (`nutriai-prod` namespace, `main` branch, manual ArgoCD sync) —
  the default and only environment enabled out of the box, given the
  capacity budget above.
- **dev** (`nutriai-dev` namespace, `dev` branch, auto-sync) — fully defined
  but kept opt-in (`argocd/apps-optional/nutriai-dev.yaml`) since running
  both at once won't fit on 2 nodes. See
  [09-argocd-gitops.md](09-argocd-gitops.md).
