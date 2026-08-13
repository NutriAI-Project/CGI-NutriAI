#!/usr/bin/env bash
## Creates one ECR repository per microservice in us-east-1.
## NOT executed automatically — review then run yourself once your AWS CLI
## is configured (`aws configure` or SSO). See docs/03-aws-bootstrap.md.
##
## Usage: AWS_REGION=us-east-1 ./01-create-ecr-repos.sh
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
SERVICES=(
  auth-service
  profile-service
  diet-service
  health-service
  document-service
  notification-service
  admin-service
  api-gateway-service
  frontend-service
)

echo "Using AWS account: $(aws sts get-caller-identity --query Account --output text)"
echo "Region: ${REGION}"

for svc in "${SERVICES[@]}"; do
  repo="nutriai/${svc}"
  if aws ecr describe-repositories --repository-names "${repo}" --region "${REGION}" >/dev/null 2>&1; then
    echo "✓ ${repo} already exists"
  else
    echo "Creating ${repo} ..."
    aws ecr create-repository \
      --repository-name "${repo}" \
      --region "${REGION}" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 \
      --tags Key=project,Value=nutriai Key=managed-by,Value=cgi-nutriai-scripts

    # Keep only the last 20 images per repo to control storage cost
    aws ecr put-lifecycle-policy \
      --repository-name "${repo}" \
      --region "${REGION}" \
      --lifecycle-policy-text '{
        "rules": [{
          "rulePriority": 1,
          "description": "Keep last 20 images",
          "selection": {"tagStatus": "any", "countType": "imageCountMoreThan", "countNumber": 20},
          "action": {"type": "expire"}
        }]
      }'
  fi
done

echo ""
echo "Done. Registry URL: $(aws sts get-caller-identity --query Account --output text).dkr.ecr.${REGION}.amazonaws.com"
echo "Update helm/nutriai/values.yaml global.imageRegistry with the above value."
