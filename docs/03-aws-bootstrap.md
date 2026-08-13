# AWS Bootstrap Runbook

Everything here is a script or a documented command — **nothing in this repo
executes it for you**. Run these yourself, in order, once you're ready to
provision. Region throughout: `us-east-1`.

> **On credentials:** configure the AWS CLI with `aws configure` (or SSO)
> using your own access key/secret **locally, never committed to this repo
> or pasted into any file here**. If you shared an access key/secret key in
> chat to get this generated, rotate it once you're done setting this up —
> treat anything typed into a chat as no longer secret.

## 1. Connect through the bastion host

Your EKS API endpoint is presumably private, which is why the bastion
(`204.236.210.16`) exists. From your workstation:

```bash
# PuTTY users: convert the .ppk to OpenSSH format once with puttygen
#   puttygen Murali-CGI-Key.ppk -O private-openssh -o murali-cgi-key.pem
# then:
chmod 600 murali-cgi-key.pem
ssh -i murali-cgi-key.pem ec2-user@204.236.210.16
```

From there (or via an SSH `ProxyJump` if you prefer running kubectl
locally):

```bash
aws configure                 # your own credentials, on the bastion
aws eks update-kubeconfig --name <your-cluster-name> --region us-east-1
kubectl get nodes             # confirms connectivity — should show 2 t3.medium nodes
```

## 2. Create the ECR repositories

```bash
cd CGI-NutriAI/scripts
./01-create-ecr-repos.sh
```

Creates `nutriai/<service>` for all 9 services, image scanning on push,
lifecycle policy capping history at 20 images. Copy the printed registry
URL into `helm/nutriai/values.yaml` → `global.imageRegistry`.

## 3. Set up GitHub Actions → AWS via OIDC (no static keys in CI)

```bash
GITHUB_ORG=NutriAI-Project GITHUB_REPO=CGI-NutriAI ./02-setup-github-oidc-role.sh
```

Creates the GitHub OIDC provider (if missing) + an IAM role scoped to
`ecr:*` on `nutriai/*` repos only, trusted by this repo's GitHub Actions.
Add the printed role ARN as a repo secret:

```bash
gh secret set AWS_GITHUB_ACTIONS_ROLE_ARN --repo NutriAI-Project/CGI-NutriAI --body "arn:aws:iam::<account>:role/nutriai-github-actions-role"
```

## 4. Create the EFS filesystem (for document-service's shared PVC)

```bash
FS_ID=$(aws efs create-file-system --region us-east-1 \
  --tags Key=Name,Value=nutriai-efs --query FileSystemId --output text)
echo "$FS_ID"

# Mount target in each subnet your worker nodes use, with a security group
# that allows inbound 2049 (NFS) from the node security group:
aws efs create-mount-target --file-system-id "$FS_ID" --subnet-id <subnet-1> --security-groups <nfs-sg>
aws efs create-mount-target --file-system-id "$FS_ID" --subnet-id <subnet-2> --security-groups <nfs-sg>
```

Put `$FS_ID` into `helm/nutriai/values.yaml` → `storage.efsFileSystemId`.

## 5. Install cluster add-ons

Run **from the bastion** (or anywhere with kubectl access):

```bash
CLUSTER_NAME=<your-cluster-name> ./03-install-cluster-addons.sh
```

Installs, in order: EBS CSI driver, EFS CSI driver, metrics-server (HPAs
need this), Gateway API CRDs + kgateway, ArgoCD (core install), External
Secrets Operator. Each is idempotent — safe to re-run.

## 6. IAM roles the cluster add-ons themselves need (IRSA)

The EBS/EFS CSI drivers and External Secrets Operator each need an IAM role
bound to their ServiceAccount via IRSA (OIDC federation with the *cluster's*
own OIDC provider — different from the GitHub OIDC provider in step 3).
If your cluster doesn't already have these:

```bash
# One-time: enable IAM OIDC provider association for the cluster
eksctl utils associate-iam-oidc-provider --cluster <your-cluster-name> --region us-east-1 --approve

eksctl create iamserviceaccount \
  --cluster <your-cluster-name> --region us-east-1 \
  --namespace kube-system --name ebs-csi-controller-sa \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve

eksctl create iamserviceaccount \
  --cluster <your-cluster-name> --region us-east-1 \
  --namespace kube-system --name efs-csi-controller-sa \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy \
  --approve
```

External Secrets Operator's role needs a custom policy scoped to
`secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:*:*:secret:nutriai/*`
— see [09-argocd-gitops.md](09-argocd-gitops.md) §3 for the exact steps
alongside the ClusterSecretStore.

## Next

[04-kubernetes-manifests.md](04-kubernetes-manifests.md) for what gets
deployed, or jump straight to [10-runbook-end-to-end.md](10-runbook-end-to-end.md)
for the full zero-to-deployed sequence.
