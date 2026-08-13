# End-to-End Runbook: Zero → Deployed → Tested

Follow in order. Each step links back to the page with full detail.

## Phase 1 — AWS & cluster prerequisites ([03-aws-bootstrap.md](03-aws-bootstrap.md))

```bash
ssh -i murali-cgi-key.pem ec2-user@204.236.210.16      # 1. bastion
aws configure                                           # 2. your own creds, on the bastion
aws eks update-kubeconfig --name <cluster> --region us-east-1
kubectl get nodes                                        # confirm 2x t3.medium

cd CGI-NutriAI/scripts
./01-create-ecr-repos.sh                                 # 3. ECR
GITHUB_ORG=NutriAI16-ORG GITHUB_REPO=CGI-NutriAI ./02-setup-github-oidc-role.sh   # 4. CI role
# 5. EFS filesystem — see docs/03-aws-bootstrap.md §4, then set storage.efsFileSystemId
CLUSTER_NAME=<cluster> ./03-install-cluster-addons.sh     # 6. CSI drivers, metrics-server, kgateway, ArgoCD, ESO
```

## Phase 2 — Repo configuration

```bash
# helm/nutriai/values.yaml
global.imageRegistry: "<account-id>.dkr.ecr.us-east-1.amazonaws.com"
storage.efsFileSystemId: "fs-..."

gh secret set AWS_GITHUB_ACTIONS_ROLE_ARN --repo NutriAI16-ORG/CGI-NutriAI --body "arn:aws:iam::<account>:role/nutriai-github-actions-role"
```
Commit and push these two edits.

## Phase 3 — Secrets ([09-argocd-gitops.md](09-argocd-gitops.md) §3)

Either populate AWS Secrets Manager (prod path, `externalSecrets.enabled: true`,
already the default in `values-prod.yaml`) or flip it off and
`kubectl create secret` by hand for a quick lab run.

## Phase 4 — ArgoCD bootstrap ([09-argocd-gitops.md](09-argocd-gitops.md))

```bash
kubectl apply -f argocd/projects/nutriai-project.yaml
kubectl apply -f argocd/secretstore.yaml         # only if using ExternalSecrets
kubectl apply -f argocd/bootstrap/root-app.yaml
argocd app sync nutriai-prod
argocd app wait nutriai-prod --health
```

## Phase 5 — Build & push your first images ([08-cicd-github-actions.md](08-cicd-github-actions.md))

```bash
for svc in auth-service profile-service diet-service health-service document-service \
           notification-service admin-service api-gateway-service frontend-service; do
  git tag "${svc}-v0.1.0"
  git push origin "${svc}-v0.1.0"
done
```

Each tag triggers its own `ci-<service>.yml` → builds, pushes to ECR, bumps
`values-prod.yaml`. Watch in `gh run list` / the Actions tab. Each push to
`values-prod.yaml` makes `nutriai-prod` go OutOfSync in ArgoCD — sync again:

```bash
argocd app sync nutriai-prod
```

## Phase 6 — Verify pods are healthy

```bash
kubectl -n nutriai-prod get pods
kubectl -n nutriai-prod get hpa
kubectl -n nutriai-prod get pvc
kubectl -n nutriai-prod get httproute,gateway
```

## Phase 7 — Get your test URL ([06-gateway-routing.md](06-gateway-routing.md))

```bash
# On the bastion:
kubectl -n nutriai-prod port-forward svc/nutriai-gateway 8080:80 --address 0.0.0.0 &

# On your workstation:
ssh -i murali-cgi-key.pem -L 8080:localhost:8080 ec2-user@204.236.210.16
```

Open **http://localhost:8080/** — the frontend. Try a few of the direct
service routes too:

```bash
curl http://localhost:8080/auth-service/health
curl http://localhost:8080/diet-service/health
curl http://localhost:8080/api/health
```

## Phase 8 — Exercise HPA / rollout / rollback, to confirm they work

```bash
# HPA: generate load against a service and watch it scale
kubectl -n nutriai-prod run load --image=busybox --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- http://auth-service:8001/health; done"
kubectl -n nutriai-prod get hpa auth-service -w

# Rollout: bump one tag and watch a zero-downtime rolling update
helm upgrade nutriai helm/nutriai -f helm/nutriai/values.yaml -f helm/nutriai/values-prod.yaml \
  -n nutriai-prod --set services.auth-service.image.tag=v0.1.1 --reuse-values
kubectl -n nutriai-prod rollout status deployment/auth-service

# Rollback
helm rollback nutriai -n nutriai-prod
```

## You're done when

- `kubectl -n nutriai-prod get pods` shows all 9 Deployments + `postgres-0` Running
- `http://localhost:8080/` loads the frontend through the bastion tunnel
- `argocd app get nutriai-prod` shows `Healthy` / `Synced`
- A tagged push (Phase 5) round-trips through CI → ECR → git commit → ArgoCD OutOfSync automatically
