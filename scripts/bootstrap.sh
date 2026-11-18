#!/usr/bin/env bash

set -euo pipefail

export AWS_REGION="${AWS_REGION:-us-east-1}"

echo "Checking AWS identity..."

aws sts get-caller-identity

ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account \
  --output text)

echo "Account: ${ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"

echo "Checking CDK bootstrap stack..."

aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --region "${AWS_REGION}" \
  --query 'Stacks[0].[StackName,StackStatus]' \
  --output table

echo "CDK bootstrap environment is available."
echo "No bootstrap redeployment was performed."
