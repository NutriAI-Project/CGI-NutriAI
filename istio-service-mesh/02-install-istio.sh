#!/usr/bin/env bash
## One-time Istio control-plane install. Run FROM THE BASTION HOST (or
## anywhere with kubectl access), same pattern as
## ../scripts/03-install-cluster-addons.sh. NOT executed automatically.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:?set CLUSTER_NAME=<your-eks-cluster-name>}"
REGION="${AWS_REGION:-us-east-1}"
ISTIO_VERSION="${ISTIO_VERSION:-1.23.2}"

echo "==> Point kubectl at the cluster"
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${REGION}"

echo "==> Install istioctl (${ISTIO_VERSION}) locally if not already present"
if ! command -v istioctl >/dev/null 2>&1; then
  curl -fsSL https://istio.io/downloadIstio | ISTIO_VERSION="${ISTIO_VERSION}" TARGET_ARCH=x86_64 sh -
  export PATH="${PWD}/istio-${ISTIO_VERSION}/bin:${PATH}"
  echo "istioctl installed to ${PWD}/istio-${ISTIO_VERSION}/bin — add it to your PATH permanently if you'll run this again"
fi
istioctl version --remote=false

echo "==> Pre-flight check against this cluster"
istioctl x precheck

echo "==> Install the control plane from 01-istio-operator.yaml"
istioctl install -f "$(dirname "$0")/01-istio-operator.yaml" -y

echo "==> Verify"
kubectl get pods -n istio-system
istioctl verify-install -f "$(dirname "$0")/01-istio-operator.yaml"

echo ""
echo "Istio installed. Next: kubectl apply -f 00-namespace.yaml"
