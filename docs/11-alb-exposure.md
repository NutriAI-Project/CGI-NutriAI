# Public exposure via ALB (optional, additive)

Everything referenced here lives in [`../alb-ingress/`](../alb-ingress/)
and is **not applied to any cluster** — it's ready to run when you decide
you want a public URL instead of (or alongside) the bastion-tunnel access
path in [06-gateway-routing.md](06-gateway-routing.md) and
[09-argocd-gitops.md](09-argocd-gitops.md). Read
[01-architecture.md](01-architecture.md) §"Why no LoadBalancer" first —
this section is the deliberate opt-in path out of that default.

## What gets created

One AWS Application Load Balancer, shared by two `Ingress` objects via the
AWS Load Balancer Controller's `group.name` mechanism, host-routing to two
different in-cluster destinations:

```
Internet
   │
   ▼
Route53 (app.nutriai.example.com, argocd.nutriai.example.com — both CNAME → same ALB)
   │
   ▼
ALB "nutriai-alb" (public subnets, HTTPS:443 via ACM cert, HTTP:80 → redirect)
   ├── Host: app.nutriai.example.com    → nutriai-gateway Service (ClusterIP, kgateway) → existing HTTPRoutes → 9 backend Services
   └── Host: argocd.nutriai.example.com → argocd-server Service (ClusterIP)
```

The controller talks to pod IPs directly (`target-type: ip`), so neither
Service changes type — `nutriai-gateway` stays `ClusterIP` exactly as
`helm/nutriai/values.yaml` sets it, and `argocd-server` stays whatever
`core-install.yaml` created. The ALB is the *only* new AWS resource; no
NodePort, no second LoadBalancer.

## Deploy order (from the bastion)

```bash
cd alb-ingress
CLUSTER_NAME=<your-eks-cluster-name> ./01-install-aws-load-balancer-controller.sh
kubectl apply -f 02-ingressclass.yaml
kubectl apply -f 03-nutriai-gateway-ingress.yaml
kubectl -n argocd patch configmap argocd-cmd-params-cm --type merge -p '{"data":{"server.insecure":"true"}}'
kubectl -n argocd rollout restart deployment argocd-server
kubectl apply -f 04-argocd-ingress.yaml
```

## Getting the URL

```bash
# Wait for the controller to provision the ALB (1-3 min), then:
kubectl get ingress -A -l app.kubernetes.io/part-of=nutriai-alb

# Just the DNS name:
kubectl get ingress nutriai-gateway -n nutriai-prod -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

That hostname (something like
`nutriai-alb-123456789.us-east-1.elb.amazonaws.com`) works immediately —
test with `curl -H "Host: app.nutriai.example.com" http://<that-hostname>/`
before DNS is even set up. Once Route53 CNAMEs point your real hostnames
at it, use those directly.

## TLS

Request/validate an ACM certificate for both hostnames (or a wildcard
`*.nutriai.example.com`) in the **same region as the cluster**, then
replace `<ACM_CERTIFICATE_ARN>` in both
`alb-ingress/03-nutriai-gateway-ingress.yaml` and
`alb-ingress/04-argocd-ingress.yaml`:

```bash
aws acm request-certificate --domain-name "*.nutriai.example.com" \
  --validation-method DNS --region us-east-1
# add the returned CNAME validation record in Route53, wait for ISSUED, then:
aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='*.nutriai.example.com'].CertificateArn" --output text
```

## Verifying end to end

```bash
curl -sk https://app.nutriai.example.com/                       # frontend
curl -sk https://app.nutriai.example.com/auth-service/health     # a backend, direct path
curl -sk https://argocd.nutriai.example.com/api/version          # ArgoCD API reachable
```

Open `https://argocd.nutriai.example.com` in a browser for the UI —  no
SSH tunnel needed anymore (the tunnel path still works too, nothing was
removed).

## Cost note

One ALB (shared) + its data processing/LCU charges — check current
pricing for `us-east-1`. This is the tradeoff the base design avoided by
default; it's now explicit and opt-in.

## Rollback

See `alb-ingress/README.md` §Rollback.
