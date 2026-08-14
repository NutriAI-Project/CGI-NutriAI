# ALB Ingress — public exposure for kgateway + ArgoCD

Everything in this folder is **ready to apply, not yet applied to any
cluster**. It's an *additive, opt-in* layer on top of the existing
ClusterIP-only design in [`../docs/06-gateway-routing.md`](../docs/06-gateway-routing.md)
— nothing here changes how `helm/nutriai` or `argocd/` behave, and the
bastion-tunnel access path keeps working exactly as before if you never
apply these manifests.

## Why this exists

The base design deliberately avoids a cloud LoadBalancer (see
[`../docs/01-architecture.md`](../docs/01-architecture.md) §"Why no
LoadBalancer") to control cost on a 2-node lab cluster. This folder is for
the moment you *do* want a real public URL — e.g. to demo the app, or to
give the team browser access to the ArgoCD UI without an SSH tunnel — using
the **AWS Load Balancer Controller** to provision **one shared
Application Load Balancer (ALB)** that host-routes to two different
in-cluster destinations:

| Hostname (placeholder — replace with yours) | Routes to | Namespace |
|---|---|---|
| `app.nutriai.example.com` | `nutriai-gateway` Service (kgateway's Envoy proxy) → existing HTTPRoutes | `nutriai-prod` |
| `argocd.nutriai.example.com` | `argocd-server` Service | `argocd` |

Both `Ingress` objects below carry the **same**
`alb.ingress.kubernetes.io/group.name: nutriai-alb` annotation, so the
controller merges them into **one** ALB with two listener rules
(host-based) instead of provisioning two ALBs — one bill, not two.

kgateway's Gateway stays `type: ClusterIP` exactly as
`docs/06-gateway-routing.md` sets it up — the ALB Controller targets pod
IPs directly (`target-type: ip`, works because EKS uses the VPC CNI), so
nothing about the Gateway/HTTPRoute chain changes. Path-based routing to
the 9 services still happens inside the cluster via the existing
`HTTPRoute` objects; the ALB only decides *which Service* (kgateway vs.
argocd-server) a request lands on, by hostname.

## Prerequisites this assumes

- EKS cluster with the VPC CNI (default) and **subnets tagged** for the
  controller's auto-discovery:
  - Public subnets (where the ALB's ENIs live): `kubernetes.io/role/elb=1`
  - Private subnets (where nodes/pods live): `kubernetes.io/role/internal-elb=1`
  - Both also need `kubernetes.io/cluster/<cluster-name>=shared` (or `owned`)
  If your VPC was hand-rolled (not `eksctl`), add these tags yourself —
  the controller silently finds zero subnets and the ALB never gets
  targets without them. See the architecture diagram for the intended
  subnet layout.
- An ACM certificate for HTTPS (recommended) — see step 5 below. HTTP-only
  works without it if you just want to prove connectivity first.

## Deploy order

```bash
# 1. Install the AWS Load Balancer Controller (one-time, cluster-scoped)
CLUSTER_NAME=<your-eks-cluster-name> ./01-install-aws-load-balancer-controller.sh

# 2. IngressClass (one-time, cluster-scoped)
kubectl apply -f 02-ingressclass.yaml

# 3. Expose kgateway
kubectl apply -f 03-nutriai-gateway-ingress.yaml

# 4. Expose ArgoCD (also flips argocd-server to --insecure so TLS is
#    terminated at the ALB, not double-wrapped — see the file's header
#    comment before applying)
kubectl apply -n argocd -f 04-argocd-server-insecure-patch.yaml
kubectl apply -f 04-argocd-ingress.yaml

# 5. Get the shared ALB's DNS name (same for both — host header decides
#    which app you land on)
kubectl get ingress -A -l app.kubernetes.io/part-of=nutriai-alb \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.loadBalancer.ingress[0].hostname}{"\n"}{end}'

# 6. Point DNS at it (Route53 example — swap in your hosted zone)
aws route53 change-resource-record-sets --hosted-zone-id <ZONE_ID> --change-batch '{
  "Changes": [
    {"Action":"UPSERT","ResourceRecordSet":{"Name":"app.nutriai.example.com","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"<ALB_DNS_NAME>"}]}},
    {"Action":"UPSERT","ResourceRecordSet":{"Name":"argocd.nutriai.example.com","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"<ALB_DNS_NAME>"}]}}
  ]
}'
```

Full command reference (including HTTPS/ACM, verification, and
troubleshooting) is in
[`../docs/11-alb-exposure.md`](../docs/11-alb-exposure.md) and in the
combined Word document.

## Files

| File | Purpose |
|---|---|
| `01-install-aws-load-balancer-controller.sh` | IAM policy + IRSA role + Helm install of the controller itself |
| `02-ingressclass.yaml` | `IngressClass`/`IngressClassParams` (`alb`, cluster-scoped) |
| `03-nutriai-gateway-ingress.yaml` | ALB `Ingress` → `nutriai-gateway` Service (kgateway), host `app.nutriai.example.com` |
| `04-argocd-server-insecure-patch.yaml` | `kubectl patch` payload: argocd-server serves plain HTTP so the ALB is the single TLS termination point |
| `04-argocd-ingress.yaml` | ALB `Ingress` → `argocd-server` Service, host `argocd.nutriai.example.com` |

## Rollback

```bash
kubectl delete -f 04-argocd-ingress.yaml -f 03-nutriai-gateway-ingress.yaml -f 02-ingressclass.yaml
helm uninstall aws-load-balancer-controller -n kube-system
```
The ALB itself is deleted automatically by the controller a few minutes
after the last `Ingress` referencing it is removed — confirm in the EC2
console (Load Balancers) that it's gone before assuming the billing has
stopped.
