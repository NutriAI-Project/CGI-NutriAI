# Gateway Routing (kgateway, path-based, no LoadBalancer)

## Install (cluster-scoped, once — see [03-aws-bootstrap.md](03-aws-bootstrap.md) §5)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml
helm upgrade --install kgateway-crds oci://cr.kgateway.dev/kgateway-dev/charts/kgateway-crds -n kgateway-system --create-namespace
helm upgrade --install kgateway oci://cr.kgateway.dev/kgateway-dev/charts/kgateway -n kgateway-system
```

**Then, before creating any Gateway** — kgateway defaults every Gateway's
proxy Service to `type: LoadBalancer`, which provisions a real, billed AWS
ELB. This was caught live on the first deploy: an annotation on the Gateway
does *not* control this on this Gateway API CRD version (no
`spec.infrastructure` field present); the only mechanism is a cluster-scoped
`GatewayParameters` referenced from the `GatewayClass`, applying to every
Gateway using that class:

```bash
cat <<EOF | kubectl apply -f -
apiVersion: gateway.kgateway.dev/v1alpha1
kind: GatewayParameters
metadata:
  name: nutriai-gateway-params
  namespace: kgateway-system
spec:
  kube:
    service:
      type: ClusterIP
EOF
kubectl patch gatewayclass kgateway --type=merge -p \
  '{"spec":{"parametersRef":{"group":"gateway.kgateway.dev","kind":"GatewayParameters","name":"nutriai-gateway-params","namespace":"kgateway-system"}}}'
```

`scripts/03-install-cluster-addons.sh` now does this automatically as part
of the kgateway install step.

## What the chart creates

One `Gateway` (`nutriai-gateway`, `gatewayClassName: kgateway`, HTTP
listener on port 80, `ClusterIP` — **not** a cloud LoadBalancer), plus one
`HTTPRoute` per service:

| Path | → Service | Rewrite |
|---|---|---|
| `/` | `frontend-service:80` | none (SPA + its own internal `/api` proxy) |
| `/api` | `api-gateway-service:8000` | strip `/api` prefix |
| `/auth-service` | `auth-service:8001` | strip prefix |
| `/document-service` | `document-service:8002` | strip prefix |
| `/diet-service` | `diet-service:8003` | strip prefix |
| `/health-service` | `health-service:8004` | strip prefix |
| `/notification-service` | `notification-service:8005` | strip prefix |
| `/profile-service` | `profile-service:8006` | strip prefix |
| `/admin-service` | `admin-service:8007` | strip prefix |

Gateway API resolves overlapping matches by specificity (longest path
prefix wins), so `/auth-service` correctly takes precedence over `/` —  no
manual route ordering needed.

Two ways to reach a backend from outside: through `/` → frontend → its own
internal `/api` proxy → `api-gateway-service` (the "real" app path), **or**
directly at e.g. `/auth-service/...` for testing an individual service in
isolation (per your ask for full path-based routing to every service, not
just the front door).

## Getting a URL to test against — no LoadBalancer

Since the Gateway's Service is `ClusterIP`, there's no public DNS name.
Two supported options:

### Option A — kubectl port-forward through the bastion (recommended)

```bash
# On the bastion (has kubectl access to the cluster):
kubectl -n nutriai-prod port-forward svc/nutriai-gateway 8080:80 --address 0.0.0.0 &

# From your workstation, tunnel to the bastion's forwarded port over SSH:
ssh -i murali-cgi-key.pem -L 8080:localhost:8080 ec2-user@204.236.210.16
```

Now open **http://localhost:8080/** in your browser — that's your test
URL. `Ctrl+C`/close the SSH session to tear the tunnel down; nothing is
exposed to the internet at any point.

### Option B — NodePort (a stable address without a full LB)

Set `gateway.serviceType: NodePort` in `values-prod.yaml`, `helm upgrade`,
then:

```bash
kubectl -n nutriai-prod get svc nutriai-gateway   # note the NodePort, e.g. 31080
```

If the worker nodes' security group allows inbound from the bastion's SG
on that port, and the bastion has a route to the node's private IP, you can
reach it via `http://<bastion-public-ip>:<nodeport>/` (204.236.210.16 sits
in front) with a small `iptables`/`socat` forward on the bastion — treat
this as an internal test convenience, not a production entry point; a real
public entry point should go through a proper ALB + WAF + TLS, deliberately
out of scope here since you asked to avoid a LoadBalancer.

## Verifying routes

```bash
kubectl -n nutriai-prod get gateway nutriai-gateway
kubectl -n nutriai-prod get httproute
curl -s http://localhost:8080/auth-service/health   # via the port-forward from Option A
```
