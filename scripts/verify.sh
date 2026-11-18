#!/usr/bin/env bash

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

echo "=================================="
echo "AWS IDENTITY"
echo "=================================="

aws sts get-caller-identity

echo "=================================="
echo "CLOUDFORMATION STACKS"
echo "=================================="

for STACK in \
  CommerceRegistryStack \
  CommercePlatformStack \
  CommercePipelineStack
do
  aws cloudformation describe-stacks \
    --stack-name "${STACK}" \
    --region "${REGION}" \
    --query 'Stacks[0].[StackName,StackStatus]' \
    --output table
done

echo "=================================="
echo "ECS CLUSTER"
echo "=================================="

aws ecs describe-clusters \
  --clusters commerce-runtime-cluster \
  --region "${REGION}" \
  --query 'clusters[].{Name:clusterName,Status:status}' \
  --output table

echo "=================================="
echo "ECS SERVICES"
echo "=================================="

aws ecs describe-services \
  --cluster commerce-runtime-cluster \
  --services \
    commerce-web-service \
    commerce-worker-service \
  --region "${REGION}" \
  --query 'services[].{Name:serviceName,Status:status,Desired:desiredCount,Running:runningCount}' \
  --output table

echo "=================================="
echo "RDS"
echo "=================================="

aws rds describe-db-instances \
  --db-instance-identifier commerce-primary-db \
  --region "${REGION}" \
  --query 'DBInstances[0].{Status:DBInstanceStatus,MultiAZ:MultiAZ,Engine:Engine}' \
  --output table

echo "=================================="
echo "SQS QUEUES"
echo "=================================="

aws sqs list-queues \
  --region "${REGION}" \
  --output table

echo "=================================="
echo "BACKUP VAULT"
echo "=================================="

aws backup describe-backup-vault \
  --backup-vault-name resilient-commerce-platform-db-vault-03 \
  --region "${REGION}" \
  --query '{Name:BackupVaultName,RecoveryPoints:NumberOfRecoveryPoints}' \
  --output table

echo "=================================="
echo "CODEPIPELINE"
echo "=================================="

aws codepipeline get-pipeline-state \
  --name commerce-delivery-pipeline \
  --region "${REGION}" \
  --query 'stageStates[*].[stageName,latestExecution.status]' \
  --output table

echo "=================================="
echo "VERIFICATION FINISHED"
echo "=================================="
