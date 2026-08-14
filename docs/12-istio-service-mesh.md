# Istio service mesh — traffic distribution demo (optional, separate stack)

Everything referenced here lives in
[`../istio-service-mesh/`](../istio-service-mesh/) and is **not applied to
any cluster**. It is intentionally independent of `helm/nutriai`,
`argocd/`, and `alb-ingress/` — its own namespace (`nutriai-mesh`), its
own ALB, its own two-service demo. See the folder's `README.md` for the
full rationale (short version: injecting Istio sidecars into
`nutriai-prod` would blow the 17-pod-per-node ceiling documented in
[01-architecture.md](01-architecture.md)).

## What it demonstrates

| Concern | Mechanism | File |
|---|---|---|
| mTLS between services | `PeerAuthentication` (STRICT) | `03-peerauthentication-mtls.yaml` |
| Weighted canary rollout | `DestinationRule` subsets + `VirtualService` weights (90/10, 80/20) | `destinationrules/`, `virtualservices/` |
| Targeted canary testing | `x-canary: true` header → forced 100% v2 | same `VirtualService`s |
| North-south + east-west routing from one policy | `gateways: [mesh, nutriai-mesh-gateway]` | `virtualservices/01-frontend-service-vs.yaml` |
| Mesh-level authorization (zero-trust) | Default-deny `AuthorizationPolicy` + explicit allows | `07-authorizationpolicy.yaml` |
| Kubernetes RBAC for mesh config | `Role`/`RoleBinding` scoped to `nutriai-mesh` | `rbac/mesh-editor-role.yaml` |
| Public entry point | ALB (own, separate from `alb-ingress/`) → `istio-ingressgateway` | `08-alb-ingress-for-istio.yaml` |

## Deploy order (from the bastion)

```bash
cd istio-service-mesh
CLUSTER_NAME=<your-eks-cluster-name> ../alb-ingress/01-install-aws-load-balancer-controller.sh   # skip if already installed
CLUSTER_NAME=<your-eks-cluster-name> ./02-install-istio.sh
kubectl apply -f 00-namespace.yaml
kubectl apply -f 03-peerauthentication-mtls.yaml
kubectl apply -f canary-deployments/
kubectl apply -f destinationrules/
kubectl apply -f virtualservices/
kubectl apply -f 06-istio-gateway.yaml
kubectl apply -f 07-authorizationpolicy.yaml
kubectl apply -f rbac/
kubectl apply -f 08-alb-ingress-for-istio.yaml
```

## Verifying the traffic split

```bash
# Confirm both subsets are up
kubectl -n nutriai-mesh get pods -l app=frontend-service --show-labels

# Send 20 requests through the mesh gateway and count which version answered
# (assumes frontend-service returns an identifying header/body per version —
#  adjust the grep to whatever your image actually exposes, e.g. a build tag)
ALB_HOST=$(kubectl get ingress nutriai-mesh-ingress -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
for i in $(seq 1 20); do
  curl -s -H "Host: mesh.nutriai.example.com" "http://${ALB_HOST}/" | grep -o 'version.*' ;
done | sort | uniq -c

# Force the canary path regardless of weight
curl -s -H "Host: mesh.nutriai.example.com" -H "x-canary: true" "http://${ALB_HOST}/"
```

## Verifying mTLS + authorization

```bash
istioctl proxy-config secret <a-frontend-pod> -n nutriai-mesh          # confirms mTLS certs are issued
istioctl authz check <a-frontend-pod>.nutriai-mesh                     # summarizes effective AuthorizationPolicy

# Prove default-deny actually denies: exec into a pod in a DIFFERENT
# namespace and confirm it CANNOT reach api-gateway-service in nutriai-mesh
kubectl run -n default probe --rm -it --image=curlimages/curl --restart=Never -- \
  curl -s -o /dev/null -w "%{http_code}\n" http://api-gateway-service.nutriai-mesh.svc.cluster.local:8000/health
# expect connection reset/refused (RBAC: ACCESS DENIED), not a 200
```

## Getting the URL

```bash
kubectl get ingress nutriai-mesh-ingress -n istio-system \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

Point `mesh.nutriai.example.com` (Route53 CNAME) at that hostname, same
pattern as [11-alb-exposure.md](11-alb-exposure.md).

## Extending to more services

Copy the three-file pattern
(`canary-deployments/0N-<service>-v1.yaml` + `-v2.yaml` + `-svc.yaml`,
`destinationrules/0N-<service>-dr.yaml`,
`virtualservices/0N-<service>-vs.yaml`) per additional service, adjusting
port numbers from `helm/nutriai/values.yaml`. Watch node capacity — see
`istio-service-mesh/README.md` for why this demo intentionally stays at 2
services.

## Rollback

See `istio-service-mesh/README.md` §Rollback.
