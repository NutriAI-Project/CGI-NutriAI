#!/usr/bin/env bash
## One-time cluster bootstrap: CSI drivers for dynamic storage, metrics-server
## (required by the HPAs), Gateway API CRDs + kgateway, ArgoCD, and External
## Secrets Operator. Run this FROM THE BASTION HOST (or anywhere with kubectl
## access to the private EKS API) after `aws eks update-kubeconfig`.
## NOT executed automatically. See docs/03-aws-bootstrap.md and
## docs/09-argocd-gitops.md for the full walkthrough of each step.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:?set CLUSTER_NAME=<your-eks-cluster-name>}"
REGION="${AWS_REGION:-us-east-1}"

echo "==> Point kubectl at the cluster"
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${REGION}"
kubectl get nodes -o wide

echo "==> EBS CSI driver (dynamic gp3 PVCs — Postgres, backups)"
eksctl create addon --cluster "${CLUSTER_NAME}" --name aws-ebs-csi-driver --region "${REGION}" || true

echo "==> EFS CSI driver (shared RWX PVC — document-service uploads)"
# 1. Create the EFS filesystem itself (kept manual — one-time, ties to your VPC/SGs):
#      aws efs create-file-system --region ${REGION} --tags Key=Name,Value=nutriai-efs
#      aws efs create-mount-target --file-system-id <fs-id> --subnet-id <subnet> --security-groups <sg-allowing-2049-from-nodes>
#    Put the resulting fs-<id> into helm/nutriai/values.yaml storage.efsFileSystemId
eksctl create addon --cluster "${CLUSTER_NAME}" --name aws-efs-csi-driver --region "${REGION}" || true

echo "==> metrics-server (required for the HPAs to see CPU/memory)"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

echo "==> Gateway API CRDs"
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

echo "==> kgateway controller"
helm upgrade --install kgateway-crds oci://cr.kgateway.dev/kgateway-dev/charts/kgateway-crds \
  --namespace kgateway-system --create-namespace
helm upgrade --install kgateway oci://cr.kgateway.dev/kgateway-dev/charts/kgateway \
  --namespace kgateway-system

echo "==> ArgoCD (core install, HA components trimmed for the 2-node budget)"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/core-install.yaml

echo "==> External Secrets Operator (prod-grade secret sourcing from AWS Secrets Manager)"
helm repo add external-secrets https://charts.external-secrets.io 2>/dev/null || true
helm repo update external-secrets
helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets --create-namespace

echo ""
echo "Addons installed. Next: docs/09-argocd-gitops.md to configure the SecretStore and bootstrap ArgoCD apps."
