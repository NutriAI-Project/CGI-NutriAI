# Istio service mesh — canary traffic distribution + ALB front door

A **separate, self-contained** stack from `helm/nutriai` and
`alb-ingress/` — it does not touch the `nutriai-prod` namespace, kgateway,
or ArgoCD. Everything here is **YAML only, not applied to any cluster**.
It exists to demonstrate mesh-native traffic distribution (weighted
canary + header-based routing), mutual TLS, and mesh-scoped RBAC, fronted
by its own ALB — independent of, and safely coexistent with, the rest of
this repo.

## Why a separate namespace/stack, not `nutriai-prod`

`docs/01-architecture.md` already documents a hard **17-pod-per-node**
ceiling on the 2x t3.medium lab cluster with the existing 9
services + Postgres + kgateway + ArgoCD. Injecting Istio sidecars into
`nutriai-prod` would add one Envoy container per pod — roughly doubling
pod count there and blowing that ceiling immediately. This folder instead
stands up a small, deliberately narrow **`nutriai-mesh`** namespace with
just two services (`frontend-service`, `api-gateway-service`, each in a
`v1`/`v2` pair) to demonstrate the traffic-splitting pattern without
touching the production namespace's budget. Extending the same pattern to
the other 7 services is mechanical — copy the `destinationrules/` +
`virtualservices/` + `canary-deployments/` pattern per service — once you
have node headroom (or a 3rd node) to afford it.

## What's demonstrated

- **mTLS everywhere in the mesh** — `PeerAuthentication` set to `STRICT`
  at the namespace level; sidecar-to-sidecar traffic is encrypted and
  mutually authenticated automatically, no app changes.
- **Weighted canary traffic split** — `VirtualService` sends 90%/10% of
  `frontend-service` traffic to `v1`/`v2`, and 80%/20% for
  `api-gateway-service`, via `DestinationRule` subsets keyed off the
  `version` pod label.
- **Header-based override** — either `VirtualService` also routes 100% of
  requests carrying `x-canary: true` to `v2` regardless of the weighted
  split, for targeted testing before shifting the general weight.
- **AuthorizationPolicy** — namespace default-deny, with explicit allows
  for intra-namespace traffic and traffic arriving from
  `istio-ingressgateway` — mesh-level RBAC on top of Kubernetes RBAC.
- **Kubernetes RBAC** — a `mesh-editor` `Role`/`RoleBinding` scoping who
  may edit `VirtualService`/`DestinationRule`/`Gateway` objects in this
  namespace, separate from the cluster-wide ArgoCD `AppProject` RBAC in
  `../argocd/projects/nutriai-project.yaml`.
- **ALB in front of the mesh** — same AWS Load Balancer Controller as
  `../alb-ingress/`, but its own `Ingress`/ALB (`nutriai-mesh-alb` group)
  targeting `istio-ingressgateway`, not shared with the kgateway/ArgoCD
  ALB — this is an independent demo path.

## Deploy order

Run everything from the bastion (or wherever you have `kubectl`/`istioctl`
access), **in this order**:

```bash
# 1. Install the AWS Load Balancer Controller if you haven't already
#    (skip if you already ran ../alb-ingress/01-install-aws-load-balancer-controller.sh —
#    it's the same cluster-wide controller, install once)
CLUSTER_NAME=<your-eks-cluster-name> ../alb-ingress/01-install-aws-load-balancer-controller.sh

# 2. Install istioctl + the Istio control plane (istiod + ingress gateway)
CLUSTER_NAME=<your-eks-cluster-name> ./02-install-istio.sh

# 3. Namespace (with sidecar auto-injection enabled)
kubectl apply -f 00-namespace.yaml

# 4. Mesh-wide mTLS
kubectl apply -f 03-peerauthentication-mtls.yaml

# 5. Baseline (v1) + canary (v2) workloads, plus their Services
kubectl apply -f canary-deployments/

# 6. Traffic-management objects
kubectl apply -f destinationrules/
kubectl apply -f virtualservices/

# 7. Istio Gateway (binds the mesh's ingress gateway to a hostname)
kubectl apply -f 06-istio-gateway.yaml

# 8. AuthorizationPolicy (mesh RBAC) + Kubernetes RBAC
kubectl apply -f 07-authorizationpolicy.yaml
kubectl apply -f rbac/

# 9. Public entry point — ALB Ingress → istio-ingressgateway
kubectl apply -f 08-alb-ingress-for-istio.yaml

# 10. Get the ALB's DNS name and point DNS at it
kubectl get ingress -n istio-system nutriai-mesh-ingress \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

## Files

| Path | Purpose |
|---|---|
| `00-namespace.yaml` | `nutriai-mesh` namespace, `istio-injection: enabled` |
| `01-istio-operator.yaml` | `IstioOperator` CR — minimal profile, ingress gateway on, egress gateway off |
| `02-install-istio.sh` | Downloads `istioctl`, runs `istioctl install`, labels the namespace |
| `03-peerauthentication-mtls.yaml` | Namespace-wide `STRICT` mTLS |
| `canary-deployments/` | `v1`/`v2` `Deployment`s + one `Service` per demo service |
| `destinationrules/` | Subset definitions (`v1`, `v2`) per demo service |
| `virtualservices/` | Weighted split (90/10, 80/20) + `x-canary` header override |
| `06-istio-gateway.yaml` | Istio `Gateway` (networking.istio.io), bound to `istio-ingressgateway`, host `mesh.nutriai.example.com` |
| `07-authorizationpolicy.yaml` | Default-deny + explicit allow (mesh RBAC) |
| `rbac/` | Kubernetes `Role`/`RoleBinding` scoping mesh-config edits |
| `08-alb-ingress-for-istio.yaml` | ALB `Ingress` → `istio-ingressgateway` Service, own ALB group `nutriai-mesh-alb` |

## Shifting the canary weight (day-2 operation)

```bash
# Promote v2 to 50/50
kubectl -n nutriai-mesh patch virtualservice frontend-service --type merge -p \
  '{"spec":{"http":[{"route":[{"destination":{"host":"frontend-service","subset":"v1"},"weight":50},{"destination":{"host":"frontend-service","subset":"v2"},"weight":50}]}]}}'

# Full promotion (100% v2), then delete the v1 Deployment once confident
kubectl -n nutriai-mesh patch virtualservice frontend-service --type merge -p \
  '{"spec":{"http":[{"route":[{"destination":{"host":"frontend-service","subset":"v2"},"weight":100}]}]}}'
```

Prefer editing `virtualservices/*.yaml` and re-`kubectl apply`-ing over
ad-hoc `patch` for anything you intend to keep — this repo's GitOps
convention (see `../docs/09-argocd-gitops.md`) is git as the source of
truth, even for the mesh demo.

## Rollback

```bash
kubectl delete -f 08-alb-ingress-for-istio.yaml
kubectl delete -f rbac/ -f 07-authorizationpolicy.yaml -f 06-istio-gateway.yaml
kubectl delete -f virtualservices/ -f destinationrules/ -f canary-deployments/
kubectl delete -f 03-peerauthentication-mtls.yaml -f 00-namespace.yaml
istioctl uninstall -y --purge
kubectl delete namespace istio-system
```

Full walkthrough with expected output at each step:
[`../docs/12-istio-service-mesh.md`](../docs/12-istio-service-mesh.md).
