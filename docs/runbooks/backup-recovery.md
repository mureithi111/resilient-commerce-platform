# Database Backup and Recovery Runbook

## 1. Backup Configuration

AWS region:

us-east-1

Database:

commerce-primary-db

Backup plan:

CommerceDatabaseBackupPlan

Backup vault:

resilient-commerce-platform-db-vault-03

Retention:

35 days

## 2. Verify Backup Recovery Points

Run:

aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name resilient-commerce-platform-db-vault-03 \
  --region us-east-1 \
  --output table

Verify the recovery point status before initiating a restore.

Only COMPLETED recovery points should be considered
for a recovery exercise.

## 3. Recovery Procedure

1. Identify a completed recovery point.
2. Confirm that it belongs to commerce-primary-db.
3. Record the recovery point ARN.
4. Initiate a restore job.
5. Supply a new database identifier.
6. Configure the appropriate VPC and security groups.
7. Wait for the restored database to become available.
8. Verify database connectivity.
9. Validate recovered application records.
10. Document the recovery duration and results.

## 4. Recovery Safety

Never overwrite the production database during a recovery
exercise.

Always restore to a separate RDS instance.

Do not reconnect the production application to the restored
database without an approved recovery decision.

## 5. Recovery Evidence

Record:

- Recovery point ARN.
- Backup creation time.
- Restore initiation time.
- Restore completion time.
- Restored database identifier.
- Database validation results.
- Recovery duration.
