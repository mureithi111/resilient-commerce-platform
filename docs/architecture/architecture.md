# Resilient Commerce Platform Architecture

## 1. Overview

Resilient Commerce Platform is a containerized e-commerce application
deployed on AWS.

It consists of two independently deployed application components:

- Commerce Web API
- Commerce Background Worker

The platform uses AWS managed services for compute, networking,
persistence, messaging, caching, deployment and backup.

## 2. Network Architecture

The application uses an Amazon VPC spanning two Availability Zones.

The network architecture includes:

- Public subnets for internet-facing load balancing.
- Private application subnets for ECS workloads.
- Database subnets for persistent data services.

Application access is controlled through security groups.

## 3. Application Architecture

### Web application

The web application is built with Node.js and Express.

It provides REST endpoints for:

- Application health checks.
- Order creation.
- Order retrieval.

The application integrates with PostgreSQL, Redis and SQS.

### Background worker

The worker is an independent Node.js application.

It consumes messages from Amazon SQS and processes
order-related background tasks.

The web and worker components have separate Docker images
and ECS services.

## 4. Compute

Amazon ECS with AWS Fargate operates:

- commerce-web-service
- commerce-worker-service

The web service runs two desired tasks.

The worker service runs one desired task.

The services can be deployed independently through CodePipeline.

## 5. Data Architecture

Amazon RDS PostgreSQL provides persistent application storage.

Amazon ElastiCache for Redis provides caching.

The web application uses PostgreSQL for order persistence
and Redis for frequently accessed data.

## 6. Messaging

Amazon SQS provides asynchronous communication between
the web application and worker.

The platform includes:

- commerce-order-processing
- commerce-order-failures

The dead-letter queue receives messages after the configured
maximum receive attempts.

## 7. Load Balancing

An internet-facing Application Load Balancer distributes
incoming application traffic to the ECS web service.

The application exposes a health endpoint at:

/healthz

## 8. Availability and Resilience

The design uses multiple Availability Zones.

ECS services provide container orchestration and task replacement.

RDS provides managed relational database availability.

Redis availability and automatic failover settings should be
verified against the deployed ElastiCache configuration.

## 9. Backup and Recovery

AWS Backup protects the production database.

Backup configuration:

- Backup plan: CommerceDatabaseBackupPlan
- Backup vault: resilient-commerce-platform-db-vault-03
- Retention: 35 days

Database recovery exercises should restore to a separate
database instance before any production reconnection.

## 10. Disaster Recovery

The platform includes an S3 static continuity website:

commerce-continuity-site-345549356290-v3

Route 53 failover and secondary endpoint behavior must be
verified through actual DNS configuration and testing before
being considered operationally validated.

## 11. CI/CD Architecture

The deployment architecture is:

GitHub
  |
  v
AWS CodePipeline
  |
  v
AWS CodeBuild
  |
  v
Amazon ECR
  |
  +---- ECS Web Service
  |
  +---- ECS Worker Service

The pipeline independently deploys the web and worker images.

The GitHub repository is:

mureithi111/resilient-commerce-platform

Pipeline:

commerce-delivery-pipeline

## 12. Monitoring

Amazon CloudWatch provides infrastructure monitoring
and application logging.

The platform should be monitored for:

- ECS task health.
- Application errors.
- ALB target health.
- RDS availability.
- SQS queue depth.
- Dead-letter queue messages.
- Worker processing failures.
