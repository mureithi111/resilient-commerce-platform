# Disaster Recovery Runbook

## Scenario 1: ECS Application Failure

1. Inspect ECS service events.
2. Inspect failed task reasons.
3. Inspect CloudWatch application logs.
4. Verify ECR image availability.
5. Verify ALB target health.
6. Check security group connectivity.
7. Restore a known-good application release.
8. Verify application health.

## Scenario 2: Database Availability Failure

1. Inspect RDS instance status.
2. Inspect RDS events.
3. Check the configured Multi-AZ status.
4. Allow managed failover to complete where applicable.
5. Verify database endpoint availability.
6. Verify application database connectivity.
7. Validate order processing.

## Scenario 3: Database Corruption

1. Identify the latest valid AWS Backup recovery point.
2. Restore to a new RDS instance.
3. Verify recovered records.
4. Document the recovery point and recovery duration.
5. Obtain approval for application reconnection.
6. Perform controlled recovery.

## Scenario 4: Application Endpoint Failure

1. Inspect ALB health.
2. Verify ECS service health.
3. Verify the S3 continuity website.
4. Inspect Route 53 records and health checks.
5. Confirm whether DNS failover is configured.
6. Test failover only through an approved exercise.
7. Restore the primary endpoint.
8. Verify DNS resolution and application availability.

## Scenario 5: AWS Region-Level Disruption

1. Establish the scope of the incident.
2. Verify availability of the recovery region.
3. Identify available database backups.
4. Identify the application images and infrastructure
   required for recovery.
5. Restore database and application components.
6. Validate application functionality.
7. Coordinate DNS recovery.

## Recovery Evidence

Record:

- Incident start time.
- Detection time.
- Affected AWS services.
- Recovery point.
- Recovery initiation time.
- Recovery completion time.
- Validation results.
- Actual RTO.
- Actual RPO.
- Lessons learned.
