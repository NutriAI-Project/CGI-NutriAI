# ArgoCD — Install, Configure, App-of-Apps

## 1. Install

Already covered by `scripts/03-install-cluster-addons.sh`, spelled out here
for reference:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml
```

`core-install.yaml` (not the full `install.yaml`) is used deliberately — it
skips the Dex, notifications, and ApplicationSet-controller components to
keep ArgoCD's footprint smaller for the 2-node budget
([01-architecture.md](01-architecture.md)). Add them back later with the
full manifest if you need SSO or Slack notifications.

## 2. Access the UI/CLI

```bash
# From the bastion (or tunnel like docs/06-gateway-routing.md Option A):
kubectl -n argocd port-forward svc/argocd-server 8443:443 --address 0.0.0.0 &

# Initial admin password:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo

# Then, tunnelled through the bastion from your workstation:
ssh -i murali-cgi-key.pem -L 8443:localhost:8443 ec2-user@204.236.210.16
# open https://localhost:8443  (self-signed cert — accept the browser warning)
```

CLI login (from the bastion, or your workstation once tunnelled):

```bash
argocd login localhost:8443 --username admin --password <from above> --insecure
argocd account update-password   # change it immediately
```

## 3. External Secrets Operator + SecretStore (do this before the first sync)

`values-prod.yaml` sets `externalSecrets.enabled: true` — every service's
`Secret` becomes an `ExternalSecret` pulling from AWS Secrets Manager, so
no secret values are ever committed to git.

```bash
# a) IRSA role for the external-secrets ServiceAccount
eksctl create iamserviceaccount \
  --cluster <your-cluster-name> --region us-east-1 \
  --namespace external-secrets --name external-secrets \
  --attach-policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
  --approve
# (tighten to a custom policy scoped to secretsmanager:GetSecretValue on
#  arn:aws:secretsmanager:*:*:secret:nutriai/* once past the lab stage)

# b) the ClusterSecretStore itself
kubectl apply -f argocd/secretstore.yaml

# c) one secret per service in AWS Secrets Manager, matching the keys in
#    helm/nutriai/values-secrets.example.yaml, named nutriai/prod/<service-name>:
aws secretsmanager create-secret --name nutriai/prod/auth-service \
  --secret-string '{"JWT_SECRET_KEY":"...","ENTRA_CLIENT_ID":"...", "...": "..."}'
# repeat per service — see values-secrets.example.yaml for the exact key sets
```

Skipping ESO for a quick lab run instead: set
`externalSecrets.enabled: false` in `values-prod.yaml` and
`kubectl create secret generic <service>-secret --from-literal=...` by hand
before syncing — the native `templates/secret.yaml` won't render when
`externalSecrets.enabled` is true, and vice versa, so pick one path.

## 4. AppProject

```bash
kubectl apply -f argocd/projects/nutriai-project.yaml
```

Scopes what `nutriai-*` Applications may touch: this repo only, the
`nutriai-*` namespaces plus `argocd` itself, and a whitelist of
cluster-scoped kinds (Namespace, StorageClass, VolumeSnapshotClass,
GatewayClass). Anything else an Application tries to deploy is rejected —
defense in depth beyond RBAC on the Applications themselves.

## 5. Bootstrap the App-of-Apps

This is the **one manifest you apply by hand** — everything else follows
from it:

```bash
kubectl apply -f argocd/bootstrap/root-app.yaml
```

`nutriai-root` watches `argocd/apps/` in this repo and manages whatever
`Application` manifests it finds there — today, just `nutriai-prod.yaml`.
Add more by adding files to that folder and pushing; `nutriai-root`
auto-syncs itself (safe — it only ever creates/updates other `Application`
objects, never application workloads directly).

```bash
argocd app list
argocd app get nutriai-root
argocd app get nutriai-prod
```

## 6. Sync policy

| App | Branch | Policy |
|---|---|---|
| `nutriai-root` | `main` | automated, self-heal, prune |
| `nutriai-prod` | `main` | **manual only** — `argocd app sync nutriai-prod` or UI Sync button |
| `nutriai-dev` (opt-in, `argocd/apps-optional/`) | `dev` | automated, self-heal, prune |

```bash
argocd app sync nutriai-prod
argocd app wait nutriai-prod --health
```

## 7. Enabling the dev environment (optional, capacity permitting)

```bash
cp argocd/apps-optional/nutriai-dev.yaml argocd/apps/nutriai-dev.yaml
git add argocd/apps/nutriai-dev.yaml
git commit -m "enable dev environment"
git push
# nutriai-root picks it up automatically on its next reconcile (default: 3 min, or `argocd app sync nutriai-root`)
```

## 8. Day-2: rollback via GitOps

```bash
git log --oneline -- helm/nutriai/values-prod.yaml
git revert <bad-commit>
git push
argocd app sync nutriai-prod
```

Or, faster but leaves git and cluster state diverged until the next sync
(use for emergencies only, then reconcile git afterwards):

```bash
argocd app rollback nutriai-prod <HISTORY-ID>
```
