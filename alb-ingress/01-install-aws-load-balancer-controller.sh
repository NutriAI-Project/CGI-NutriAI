#!/usr/bin/env bash
## One-time install of the AWS Load Balancer Controller (drives the ALB from
## Ingress objects in this folder). Run FROM THE BASTION HOST (or anywhere
## with kubectl + aws + eksctl + helm access to the cluster), same pattern
## as scripts/03-install-cluster-addons.sh. NOT executed automatically.
## See docs/11-alb-exposure.md for the full walkthrough.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:?set CLUSTER_NAME=<your-eks-cluster-name>}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_NAME="AWSLoadBalancerControllerIAMPolicy"
POLICY_FILE="/tmp/alb-controller-iam-policy.json"

echo "==> Point kubectl at the cluster"
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${REGION}"

echo "==> Ensure the cluster's IAM OIDC provider is associated (needed for IRSA)"
eksctl utils associate-iam-oidc-provider --cluster "${CLUSTER_NAME}" --region "${REGION}" --approve

echo "==> Fetch AWS's official IAM policy for the controller (kept out of git — always pull the current version)"
curl -fsSL -o "${POLICY_FILE}" \
  https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.9.0/docs/install/iam_policy.json

echo "==> Patch a gap in AWS's own policy JSON: elasticloadbalancing:SetRulePriorities is missing"
## Caught live: with two Ingress objects sharing one ALB (group.name), the
## controller needs SetRulePriorities to reorder listener rules so a
## host-scoped rule evaluates before a catch-all one — without it, every
## reconcile attempt fails with AccessDenied and rule order is stuck at
## whatever it was on first creation (wrong order = the catch-all rule
## silently swallows traffic meant for the other Ingress). Confirmed via
## the controller's own reconcile error, not speculation.
python3 -c "
import json
with open('${POLICY_FILE}') as f:
    doc = json.load(f)
for stmt in doc['Statement']:
    actions = stmt.get('Action', [])
    if isinstance(actions, str):
        actions = [actions]
    if 'elasticloadbalancing:ModifyRule' in actions and 'elasticloadbalancing:SetRulePriorities' not in actions:
        actions.append('elasticloadbalancing:SetRulePriorities')
        stmt['Action'] = actions
with open('${POLICY_FILE}', 'w') as f:
    json.dump(doc, f, indent=2)
"

echo "==> Create (or reuse) the IAM policy"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
if ! aws iam get-policy --policy-arn "${POLICY_ARN}" >/dev/null 2>&1; then
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --policy-document "file://${POLICY_FILE}" \
    --query Policy.Arn --output text)
else
  # Policy already exists (e.g. re-running this script) — make sure the
  # SetRulePriorities patch above is actually applied to it.
  aws iam create-policy-version --policy-arn "${POLICY_ARN}" \
    --policy-document "file://${POLICY_FILE}" --set-as-default >/dev/null
fi
echo "Policy ARN: ${POLICY_ARN}"

echo "==> IRSA ServiceAccount for the controller (kube-system/aws-load-balancer-controller)"
eksctl create iamserviceaccount \
  --cluster "${CLUSTER_NAME}" --region "${REGION}" \
  --namespace kube-system --name aws-load-balancer-controller \
  --attach-policy-arn "${POLICY_ARN}" \
  --approve --override-existing-serviceaccounts

echo "==> Get the VPC ID (controller needs it explicitly on private-API clusters)"
VPC_ID=$(aws eks describe-cluster --name "${CLUSTER_NAME}" --region "${REGION}" \
  --query "cluster.resourcesVpcConfig.vpcId" --output text)

echo "==> Install the controller itself via Helm"
helm repo add eks https://aws.github.io/eks-charts 2>/dev/null || true
helm repo update eks
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName="${CLUSTER_NAME}" \
  --set region="${REGION}" \
  --set vpcId="${VPC_ID}" \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

echo "==> Wait for the controller to become ready"
kubectl rollout status deployment/aws-load-balancer-controller -n kube-system --timeout=180s

echo ""
echo "Controller installed. Next: kubectl apply -f 02-ingressclass.yaml"
echo "Remember: your public + private subnets must carry the"
echo "kubernetes.io/role/elb=1 / kubernetes.io/role/internal-elb=1 tags — see README.md."
