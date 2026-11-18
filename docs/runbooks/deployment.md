# Deployment Runbook

## 1. Prerequisites

- AWS CLI
- Docker
- Node.js 22
- AWS CDK v2
- Git
- Access to the AWS account
- Access to the GitHub repository

## 2. Existing AWS Environment

AWS region: us-east-1

CloudFormation stacks:

- CommerceRegistryStack
- CommercePlatformStack
- CommercePipelineStack

ECS cluster:

- commerce-runtime-cluster

ECS services:

- commerce-web-service
- commerce-worker-service

## 3. Normal Application Deployment

The normal deployment process is Git-driven.

1. Make the required application changes.
2. Run the relevant application tests.
3. Check the Git diff.
4. Commit the changes.
5. Push to the main branch.
6. Monitor commerce-delivery-pipeline.
7. Confirm the Source stage succeeds.
8. Confirm the Build stage succeeds.
9. Confirm DeployWeb succeeds.
10. Confirm DeployWorker succeeds.
11. Verify ECS service health.
12. Test the application through the ALB.

## 4. Infrastructure Changes

Before changing infrastructure:

1. Navigate to infrastructure/.
2. Run TypeScript compilation.
3. Synthesize the relevant CDK stack.
4. Review the CDK diff.
5. Confirm that existing production resources are not
   unintentionally replaced or deleted.
6. Deploy only the stack requiring modification.

Do not redeploy infrastructure merely to release an
application code change.

## 5. Deployment Verification

Check pipeline status:

aws codepipeline get-pipeline-state \
  --name commerce-delivery-pipeline \
  --region us-east-1

Check ECS services:

aws ecs describe-services \
  --cluster commerce-runtime-cluster \
  --services commerce-web-service commerce-worker-service \
  --region us-east-1

Check application health:

curl -i http://ALB_DNS/healthz

## 6. Rollback

If a deployment fails:

1. Inspect the CodePipeline execution.
2. Identify the failed stage.
3. Inspect CodeBuild logs if the build failed.
4. Inspect ECS service events if deployment failed.
5. Verify the previous working image in ECR.
6. Verify the previous task definition revision.
7. Restore the previous known-good application release.
8. Verify application health.

Do not delete the database to troubleshoot an application
deployment.

Do not recreate the VPC, RDS or Redis resources to resolve
an unrelated application deployment failure.
