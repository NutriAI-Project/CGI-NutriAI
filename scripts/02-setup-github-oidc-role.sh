#!/usr/bin/env bash
## Creates (or reuses) the GitHub OIDC identity provider in this AWS account
## and an IAM role GitHub Actions can assume — no long-lived AWS keys stored
## in GitHub Secrets. NOT executed automatically — review then run yourself.
## See docs/03-aws-bootstrap.md and docs/08-cicd-github-actions.md.
##
## Usage: GITHUB_ORG=NutriAI16-ORG GITHUB_REPO=CGI-NutriAI ./02-setup-github-oidc-role.sh
set -euo pipefail

GITHUB_ORG="${GITHUB_ORG:-NutriAI16-ORG}"
GITHUB_REPO="${GITHUB_REPO:-CGI-NutriAI}"
ROLE_NAME="${ROLE_NAME:-nutriai-github-actions-role}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OIDC_URL="token.actions.githubusercontent.com"

echo "Account: ${ACCOUNT_ID}  Repo: ${GITHUB_ORG}/${GITHUB_REPO}"

# 1. Create the OIDC provider if it doesn't already exist (idempotent — GitHub's
#    provider is commonly already registered once per account).
if aws iam get-open-id-connect-provider \
    --open-id-connect-provider-arn "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_URL}" >/dev/null 2>&1; then
  echo "✓ OIDC provider already exists"
else
  echo "Creating OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
fi

# 2. Trust policy — restrict to this exact repo, any branch/tag (tighten the
#    sub condition further, e.g. to `ref:refs/heads/main`, if you want).
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_URL}"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {"${OIDC_URL}:aud": "sts.amazonaws.com"},
      "StringLike": {"${OIDC_URL}:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"}
    }
  }]
}
EOF
)

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "Updating trust policy on existing role ${ROLE_NAME}..."
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "${TRUST_POLICY}"
else
  echo "Creating role ${ROLE_NAME}..."
  aws iam create-role --role-name "${ROLE_NAME}" --assume-role-policy-document "${TRUST_POLICY}"
fi

# 3. Least-privilege permissions: push/pull to the nutriai/* ECR repos only.
ECR_POLICY=$(cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:PutLifecyclePolicy"
      ],
      "Resource": "arn:aws:ecr:*:*:repository/nutriai/*"
    }
  ]
}
EOF
)
aws iam put-role-policy --role-name "${ROLE_NAME}" --policy-name nutriai-ecr-push --policy-document "${ECR_POLICY}"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "Done. Add this as a GitHub Actions secret named AWS_GITHUB_ACTIONS_ROLE_ARN:"
echo "  ${ROLE_ARN}"
echo ""
echo "  gh secret set AWS_GITHUB_ACTIONS_ROLE_ARN --repo ${GITHUB_ORG}/${GITHUB_REPO} --body \"${ROLE_ARN}\""
