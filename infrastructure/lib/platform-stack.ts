import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as backup from "aws-cdk-lib/aws-backup";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";

interface CommercePlatformStackProps extends cdk.StackProps {
  webRepository: ecr.IRepository;
  workerRepository: ecr.IRepository;
  databaseSecretArn: string;
}

export class CommercePlatformStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly webService: ecs.FargateService;
  public readonly workerService: ecs.FargateService;

  constructor(
    scope: Construct,
    id: string,
    props: CommercePlatformStackProps
  ) {
    super(scope, id, props);

    // 1. IMPORT EXISTING VPC

    const vpc = ec2.Vpc.fromLookup(
      this,
      "ExistingCommerceVpc",
      {
        vpcId: "vpc-0595b9f84277de233"
      }
    );

    // 2. EXISTING DATABASE SUBNETS

    const databaseSubnet1 = ec2.Subnet.fromSubnetId(
      this,
      "ExistingDatabaseSubnet1",
      "subnet-07fd9e1d94cbce453"
    );

    const databaseSubnet2 = ec2.Subnet.fromSubnetId(
      this,
      "ExistingDatabaseSubnet2",
      "subnet-0670d59e3acc8b1d9"
    );

    // 3. CREATE PUBLIC AND PRIVATE APPLICATION SUBNETS

    const az1 = vpc.availabilityZones[0];
    const az2 = vpc.availabilityZones[1];

    const internetGateway = new ec2.CfnInternetGateway(
      this,
      "CommerceInternetGateway",
      {}
    );

    const gatewayAttachment = new ec2.CfnVPCGatewayAttachment(
      this,
      "CommerceInternetGatewayAttachment",
      {
        vpcId: vpc.vpcId,
        internetGatewayId: internetGateway.ref
      }
    );

    const publicSubnet1 = new ec2.CfnSubnet(
      this,
      "CommercePublicSubnet1",
      {
        vpcId: vpc.vpcId,
        availabilityZone: az1,
        cidrBlock: "10.0.0.0/24",
        mapPublicIpOnLaunch: true
      }
    );

    const publicSubnet2 = new ec2.CfnSubnet(
      this,
      "CommercePublicSubnet2",
      {
        vpcId: vpc.vpcId,
        availabilityZone: az2,
        cidrBlock: "10.0.1.0/24",
        mapPublicIpOnLaunch: true
      }
    );

    const applicationSubnet1 = new ec2.CfnSubnet(
      this,
      "CommerceApplicationSubnet1",
      {
        vpcId: vpc.vpcId,
        availabilityZone: az1,
        cidrBlock: "10.0.2.0/24",
        mapPublicIpOnLaunch: false
      }
    );

    const applicationSubnet2 = new ec2.CfnSubnet(
      this,
      "CommerceApplicationSubnet2",
      {
        vpcId: vpc.vpcId,
        availabilityZone: az2,
        cidrBlock: "10.0.3.0/24",
        mapPublicIpOnLaunch: false
      }
    );

    // 4. PUBLIC ROUTE TABLES

    const publicRouteTable1 = new ec2.CfnRouteTable(
      this,
      "CommercePublicRouteTable1",
      {
        vpcId: vpc.vpcId
      }
    );

    const publicRouteTable2 = new ec2.CfnRouteTable(
      this,
      "CommercePublicRouteTable2",
      {
        vpcId: vpc.vpcId
      }
    );

    const publicRoute1 = new ec2.CfnRoute(
      this,
      "CommercePublicInternetRoute1",
      {
        routeTableId: publicRouteTable1.ref,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.ref
      }
    );

    const publicRoute2 = new ec2.CfnRoute(
      this,
      "CommercePublicInternetRoute2",
      {
        routeTableId: publicRouteTable2.ref,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.ref
      }
    );

    publicRoute1.addDependency(gatewayAttachment);
    publicRoute2.addDependency(gatewayAttachment);

    // Exactly ONE route-table association per public subnet.

    const publicSubnetAssociation1 =
      new ec2.CfnSubnetRouteTableAssociation(
        this,
        "CommercePublicSubnetAssociation1",
        {
          subnetId: publicSubnet1.ref,
          routeTableId: publicRouteTable1.ref
        }
      );

    const publicSubnetAssociation2 =
      new ec2.CfnSubnetRouteTableAssociation(
        this,
        "CommercePublicSubnetAssociation2",
        {
          subnetId: publicSubnet2.ref,
          routeTableId: publicRouteTable2.ref
        }
      );

    // 5. NAT GATEWAYS

    const natEip1 = new ec2.CfnEIP(
      this,
      "CommerceNatEip1",
      {
        domain: "vpc"
      }
    );

    const natEip2 = new ec2.CfnEIP(
      this,
      "CommerceNatEip2",
      {
        domain: "vpc"
      }
    );

    const natGateway1 = new ec2.CfnNatGateway(
      this,
      "CommerceNatGateway1",
      {
        subnetId: publicSubnet1.ref,
        allocationId: natEip1.attrAllocationId
      }
    );

    const natGateway2 = new ec2.CfnNatGateway(
      this,
      "CommerceNatGateway2",
      {
        subnetId: publicSubnet2.ref,
        allocationId: natEip2.attrAllocationId
      }
    );

    natGateway1.addDependency(publicSubnetAssociation1);
    natGateway2.addDependency(publicSubnetAssociation2);

    // 6. PRIVATE APPLICATION ROUTE TABLES

    const privateRouteTable1 = new ec2.CfnRouteTable(
      this,
      "CommercePrivateRouteTable1",
      {
        vpcId: vpc.vpcId
      }
    );

    const privateRouteTable2 = new ec2.CfnRouteTable(
      this,
      "CommercePrivateRouteTable2",
      {
        vpcId: vpc.vpcId
      }
    );

    const privateRoute1 = new ec2.CfnRoute(
      this,
      "CommercePrivateNatRoute1",
      {
        routeTableId: privateRouteTable1.ref,
        destinationCidrBlock: "0.0.0.0/0",
        natGatewayId: natGateway1.ref
      }
    );

    const privateRoute2 = new ec2.CfnRoute(
      this,
      "CommercePrivateNatRoute2",
      {
        routeTableId: privateRouteTable2.ref,
        destinationCidrBlock: "0.0.0.0/0",
        natGatewayId: natGateway2.ref
      }
    );

    privateRoute1.addDependency(natGateway1);
    privateRoute2.addDependency(natGateway2);

    new ec2.CfnSubnetRouteTableAssociation(
      this,
      "CommercePrivateSubnetAssociation1",
      {
        subnetId: applicationSubnet1.ref,
        routeTableId: privateRouteTable1.ref
      }
    );

    new ec2.CfnSubnetRouteTableAssociation(
      this,
      "CommercePrivateSubnetAssociation2",
      {
        subnetId: applicationSubnet2.ref,
        routeTableId: privateRouteTable2.ref
      }
    );

    // Import subnets for ECS and ALB.

    const publicSubnets = [
      ec2.Subnet.fromSubnetId(
        this,
        "ImportedPublicSubnet1",
        publicSubnet1.ref
      ),
      ec2.Subnet.fromSubnetId(
        this,
        "ImportedPublicSubnet2",
        publicSubnet2.ref
      )
    ];

    const applicationSubnets = [
      ec2.Subnet.fromSubnetId(
        this,
        "ImportedApplicationSubnet1",
        applicationSubnet1.ref
      ),
      ec2.Subnet.fromSubnetId(
        this,
        "ImportedApplicationSubnet2",
        applicationSubnet2.ref
      )
    ];

    // 7. SECURITY GROUPS

    const albSecurityGroup = new ec2.SecurityGroup(
      this,
      "CommerceAlbSecurityGroup",
      {
        vpc,
        description: "Internet-facing ALB security group",
        allowAllOutbound: false
      }
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );

    const webSecurityGroup = new ec2.SecurityGroup(
      this,
      "CommerceWebSecurityGroup",
      {
        vpc,
        description: "Commerce web application tasks",
        allowAllOutbound: true
      }
    );

    webSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      "Allow ALB traffic to web containers"
    );

    albSecurityGroup.addEgressRule(
      webSecurityGroup,
      ec2.Port.tcp(3000),
      "Allow ALB to reach web containers"
    );

    const workerSecurityGroup = new ec2.SecurityGroup(
      this,
      "CommerceWorkerSecurityGroup",
      {
        vpc,
        description: "Commerce background worker",
        allowAllOutbound: true
      }
    );

    // IMPORT EXISTING DATABASE SECURITY GROUP

    const databaseSecurityGroup =
      ec2.SecurityGroup.fromSecurityGroupId(
        this,
        "ExistingDatabaseSecurityGroup",
        "sg-0147b45f38160617a",
        {
          mutable: true
        }
      );

    databaseSecurityGroup.addIngressRule(
      webSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow web ECS tasks to access PostgreSQL"
    );

    databaseSecurityGroup.addIngressRule(
      workerSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow worker ECS tasks to access PostgreSQL"
    );

    const redisSecurityGroup = new ec2.SecurityGroup(
      this,
      "CommerceRedisSecurityGroup",
      {
        vpc,
        description: "Commerce Redis security group",
        allowAllOutbound: true
      }
    );

    redisSecurityGroup.addIngressRule(
      webSecurityGroup,
      ec2.Port.tcp(6379),
      "Allow web tasks to access Redis"
    );

    // 8. IMPORT EXISTING RDS DATABASE

    const database =
      rds.DatabaseInstance.fromDatabaseInstanceAttributes(
        this,
        "ExistingCommerceDatabase",
        {
          instanceIdentifier: "commerce-primary-db",
          instanceEndpointAddress:
            "commerce-primary-db.cu7668cicgfh.us-east-1.rds.amazonaws.com",
          port: 5432,
          securityGroups: [
            databaseSecurityGroup
          ]
        }
      );

    // 9. IMPORT DATABASE SECRET

    const databaseSecret =
      secretsmanager.Secret.fromSecretCompleteArn(
        this,
        "ExistingCommerceDatabaseSecret",
        props.databaseSecretArn
      );

    // 10. REDIS SUBNET GROUP

    const redisSubnetGroup =
      new elasticache.CfnSubnetGroup(
        this,
        "CommerceRedisSubnetGroup",
        {
          description: "Private subnets for commerce Redis",
          subnetIds: [
            databaseSubnet1.subnetId,
            databaseSubnet2.subnetId
          ],
          cacheSubnetGroupName: "commerce-redis-subnets"
        }
      );

    // 11. REDIS

    const redis =
      new elasticache.CfnReplicationGroup(
        this,
        "CommerceRedisReplicationGroup",
        {
          replicationGroupId: "commerce-cache",
          replicationGroupDescription:
            "Highly available commerce Redis cache",
          engine: "redis",
          cacheNodeType: "cache.t4g.small",
          numCacheClusters: 2,
          automaticFailoverEnabled: true,
          multiAzEnabled: true,
          atRestEncryptionEnabled: true,
          transitEncryptionEnabled: true,
          cacheSubnetGroupName:
            redisSubnetGroup.cacheSubnetGroupName,
          securityGroupIds: [
            redisSecurityGroup.securityGroupId
          ]
        }
      );

    redis.addDependency(redisSubnetGroup);

    // 12. SQS QUEUES

    const deadLetterQueue = new sqs.Queue(
      this,
      "CommerceDeadLetterQueue",
      {
        queueName: "commerce-order-failures",
        retentionPeriod: cdk.Duration.days(14),
        encryption: sqs.QueueEncryption.SQS_MANAGED
      }
    );

    const orderQueue = new sqs.Queue(
      this,
      "CommerceOrderQueue",
      {
        queueName: "commerce-order-processing",
        visibilityTimeout: cdk.Duration.seconds(120),
        retentionPeriod: cdk.Duration.days(4),
        receiveMessageWaitTime: cdk.Duration.seconds(20),
        encryption: sqs.QueueEncryption.SQS_MANAGED,
        deadLetterQueue: {
          queue: deadLetterQueue,
          maxReceiveCount: 5
        }
      }
    );

    // 13. ECS CLUSTER

    this.cluster = new ecs.Cluster(
      this,
      "CommerceEcsCluster",
      {
        clusterName: "commerce-runtime-cluster",
        vpc,
        containerInsightsV2: ecs.ContainerInsights.ENABLED
      }
    );

    // 14. CLOUDWATCH LOG GROUPS

    const webLogGroup = new logs.LogGroup(
      this,
      "CommerceWebLogGroup",
      {
        logGroupName: "/ecs/commerce-web",
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    );

    const workerLogGroup = new logs.LogGroup(
      this,
      "CommerceWorkerLogGroup",
      {
        logGroupName: "/ecs/commerce-worker",
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    );

    // 15. WEB TASK DEFINITION

    const webTaskDefinition =
      new ecs.FargateTaskDefinition(
        this,
        "CommerceWebTaskDefinition",
        {
          family: "commerce-web-task",
          cpu: 512,
          memoryLimitMiB: 1024
        }
      );

    const webContainer =
      webTaskDefinition.addContainer(
        "CommerceWebContainer",
        {
          containerName: "commerce-web",

          image: ecs.ContainerImage.fromEcrRepository(
            props.webRepository,
            "startup-fix-v1"
          ),

          logging: ecs.LogDrivers.awsLogs({
            logGroup: webLogGroup,
            streamPrefix: "commerce-web"
          }),

          environment: {
            NODE_ENV: "production",
            PORT: "3000",
            AWS_REGION: this.region,

            DB_HOST:
              "commerce-primary-db.cu7668cicgfh.us-east-1.rds.amazonaws.com",

            DB_PORT: "5432",
            DB_NAME: "commerce",

            REDIS_HOST: redis.attrPrimaryEndPointAddress,
            REDIS_PORT: "6379",
            REDIS_TLS: "true",

            ORDER_QUEUE_URL: orderQueue.queueUrl
          },

          secrets: {
            DB_USER: ecs.Secret.fromSecretsManager(
              databaseSecret,
              "username"
            ),

            DB_PASSWORD: ecs.Secret.fromSecretsManager(
              databaseSecret,
              "password"
            )
          },

          healthCheck: {
            command: [
              "CMD-SHELL",
              "node -e \"require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""
            ],
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(5),
            retries: 3,
            startPeriod: cdk.Duration.seconds(120)
          }
        }
      );

    webContainer.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP
    });

    // 16. WORKER TASK DEFINITION

    const workerTaskDefinition =
      new ecs.FargateTaskDefinition(
        this,
        "CommerceWorkerTaskDefinition",
        {
          family: "commerce-worker-task",
          cpu: 512,
          memoryLimitMiB: 1024
        }
      );

    workerTaskDefinition.addContainer(
      "CommerceWorkerContainer",
      {
        containerName: "commerce-worker",

        image: ecs.ContainerImage.fromEcrRepository(
          props.workerRepository,
          "ssl-fix-20261117-v2"
        ),

        logging: ecs.LogDrivers.awsLogs({
          logGroup: workerLogGroup,
          streamPrefix: "commerce-worker"
        }),

        environment: {
          NODE_ENV: "production",
          AWS_REGION: this.region,

          DB_HOST:
            "commerce-primary-db.cu7668cicgfh.us-east-1.rds.amazonaws.com",

          DB_PORT: "5432",
          DB_NAME: "commerce",

          ORDER_QUEUE_URL: orderQueue.queueUrl
        },

        secrets: {
          DB_USER: ecs.Secret.fromSecretsManager(
            databaseSecret,
            "username"
          ),

          DB_PASSWORD: ecs.Secret.fromSecretsManager(
            databaseSecret,
            "password"
          )
        }
      }
    );

    // 17. IAM PERMISSIONS

    orderQueue.grantSendMessages(
      webTaskDefinition.taskRole
    );

    orderQueue.grantConsumeMessages(
      workerTaskDefinition.taskRole
    );

    databaseSecret.grantRead(
      webTaskDefinition.executionRole!
    );

    databaseSecret.grantRead(
      workerTaskDefinition.executionRole!
    );

    // 18. WEB ECS SERVICE

    this.webService = new ecs.FargateService(
      this,
      "CommerceWebService",
      {
        serviceName: "commerce-web-service",
        cluster: this.cluster,
        taskDefinition: webTaskDefinition,

        desiredCount: 2,
        minHealthyPercent: 100,
        maxHealthyPercent: 200,

        assignPublicIp: false,

        securityGroups: [
          webSecurityGroup
        ],

        vpcSubnets: {
          subnets: applicationSubnets
        },

        circuitBreaker: {
          rollback: true
        },

        healthCheckGracePeriod:
          cdk.Duration.seconds(120)
      }
    );

    // 19. WORKER ECS SERVICE

    this.workerService = new ecs.FargateService(
      this,
      "CommerceWorkerService",
      {
        serviceName: "commerce-worker-service",
        cluster: this.cluster,
        taskDefinition: workerTaskDefinition,

        desiredCount: 1,
        minHealthyPercent: 100,
        maxHealthyPercent: 200,

        assignPublicIp: false,

        securityGroups: [
          workerSecurityGroup
        ],

        vpcSubnets: {
          subnets: applicationSubnets
        },

        circuitBreaker: {
          rollback: true
        }
      }
    );

    // 20. APPLICATION LOAD BALANCER

    const alb = new elbv2.ApplicationLoadBalancer(
      this,
      "CommerceApplicationLoadBalancer",
      {
        loadBalancerName: "commerce-public-alb",
        vpc,
        internetFacing: true,
        securityGroup: albSecurityGroup,

        vpcSubnets: {
          subnets: publicSubnets
        }
      }
    );

    const listener = alb.addListener(
      "CommerceHttpListener",
      {
        port: 80,
        open: false
      }
    );

    listener.addTargets(
      "CommerceWebTargets",
      {
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,

        targets: [
          this.webService
        ],

        healthCheck: {
          protocol: elbv2.Protocol.HTTP,
          path: "/healthz",
          healthyHttpCodes: "200",
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3
        }
      }
    );

    // 21. WEB AUTOSCALING

    const webScaling =
      this.webService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10
      });

    webScaling.scaleOnCpuUtilization(
      "CommerceWebCpuScaling",
      {
        targetUtilizationPercent: 60,
        scaleInCooldown: cdk.Duration.seconds(120),
        scaleOutCooldown: cdk.Duration.seconds(60)
      }
    );

    // 22. WORKER AUTOSCALING

    const workerScaling =
      this.workerService.autoScaleTaskCount({
        minCapacity: 1,
        maxCapacity: 10
      });

    workerScaling.scaleOnMetric(
      "CommerceQueueDepthScaling",
      {
        metric:
          orderQueue.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(1)
          }),

        adjustmentType:
          appscaling.AdjustmentType.CHANGE_IN_CAPACITY,

        scalingSteps: [
          {
            upper: 0,
            change: -1
          },
          {
            lower: 0,
            upper: 10,
            change: 0
          },
          {
            lower: 10,
            upper: 50,
            change: 1
          },
          {
            lower: 50,
            upper: 100,
            change: 2
          },
          {
            lower: 100,
            change: 4
          }
        ],

        cooldown: cdk.Duration.seconds(60)
      }
    );

    // 23. AWS BACKUP

    // const backupVault = new backup.BackupVault(
    //   this,
    //   "CommerceBackupVault",
    //   {
    //     backupVaultName:
    //       "resilient-commerce-platform-db-vault-03",

    //     removalPolicy: cdk.RemovalPolicy.RETAIN
    //   }
    // );

    const backupVault = backup.BackupVault.fromBackupVaultName(
  this,
  "ExistingCommerceBackupVault",
  "resilient-commerce-platform-db-vault-03"
);

    const backupPlan =
      backup.BackupPlan.daily35DayRetention(
        this,
        "CommerceDatabaseBackupPlan",
        backupVault
      );

    backupPlan.addSelection(
      "CommerceDatabaseBackupSelection",
      {
        resources: [
          backup.BackupResource.fromRdsDatabaseInstance(
            database
          )
        ]
      }
    );

    // 24. STATIC DISASTER RECOVERY WEBSITE
const fallbackWebsite = s3.Bucket.fromBucketName(
  this,
  "CommerceContinuityWebsite",
  "commerce-continuity-site-345549356290-v3"
);

new s3.CfnBucketPolicy(
  this,
  "CommerceContinuityWebsitePolicy",
  {
    bucket: "commerce-continuity-site-345549356290-v3",

    policyDocument: {
      Version: "2012-10-17",

      Statement: [
        {
          Sid: "AllowPublicReadForWebsite",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource:
            "arn:aws:s3:::commerce-continuity-site-345549356290-v3/*"
        }
      ]
    }
  }
);

    new s3deploy.BucketDeployment(
  this,
  "CommerceFallbackWebsiteDeployment",
  {
    sources: [
      s3deploy.Source.data(
        "index.html",
        `<!DOCTYPE html>
<html>
<head>
  <title>Commerce Service Continuity</title>
</head>
<body>
  <h1>Commerce Service Temporarily Unavailable</h1>
  <p>Our primary service is experiencing an interruption.</p>
  <p>Please try again shortly.</p>
</body>
</html>`
      ),
      s3deploy.Source.data(
        "error.html",
        `<!DOCTYPE html>
<html>
<head>
  <title>Commerce Service Error</title>
</head>
<body>
  <h1>Service Temporarily Unavailable</h1>
  <p>Please try again shortly.</p>
</body>
</html>`
      )
    ],
    destinationBucket: fallbackWebsite,
    prune: false
  }
);

    // 25. CLOUDWATCH MONITORING

    new cloudwatch.Alarm(
      this,
      "CommerceQueueDepthAlarm",
      {
        alarmName: "commerce-queue-depth-warning",

        metric:
          orderQueue.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(1)
          }),

        threshold: 50,
        evaluationPeriods: 2,

        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,

        alarmDescription:
          "Commerce order queue depth exceeds 50 messages"
      }
    );

    new cloudwatch.Alarm(
      this,
      "CommerceDatabaseCpuAlarm",
      {
        alarmName: "commerce-database-cpu-warning",

        metric: database.metricCPUUtilization(),

        threshold: 80,
        evaluationPeriods: 3,

        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
      }
    );

    // 26. OUTPUTS

    new cdk.CfnOutput(
      this,
      "CommerceVpcId",
      {
        value: vpc.vpcId
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceClusterName",
      {
        value: this.cluster.clusterName
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceWebServiceName",
      {
        value: this.webService.serviceName
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceWorkerServiceName",
      {
        value: this.workerService.serviceName
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceLoadBalancerDns",
      {
        value: alb.loadBalancerDnsName
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceDatabaseEndpoint",
      {
        value:
          "commerce-primary-db.cu7668cicgfh.us-east-1.rds.amazonaws.com"
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceRedisEndpoint",
      {
        value: redis.attrPrimaryEndPointAddress
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceOrderQueueUrl",
      {
        value: orderQueue.queueUrl
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceDeadLetterQueueUrl",
      {
        value: deadLetterQueue.queueUrl
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceFallbackWebsite",
      {
        value: fallbackWebsite.bucketWebsiteUrl
      }
    );

    new cdk.CfnOutput(
      this,
      "CommerceBackupVaultName",
      {
        value: backupVault.backupVaultName
      }
    );
  }
}