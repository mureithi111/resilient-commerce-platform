#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";

import { CommerceRegistryStack } from "../lib/registry-stack";
import { CommercePlatformStack } from "../lib/platform-stack";
import { CommercePipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();

/*
 * ENVIRONMENT CONFIGURATION
 */

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || "us-east-1";

if (!account) {
  throw new Error(
    "AWS account not detected. Verify AWS credentials first."
  );
}

const environment: cdk.Environment = {
  account,
  region
};

/*
 * 1. REGISTRY STACK
 */

const registryStack = new CommerceRegistryStack(
  app,
  "CommerceRegistryStack",
  {
    env: environment,
    description: "ECR repositories for the resilient commerce platform"
  }
);

/*
 * 2. PLATFORM STACK
 */

const platformStack = new CommercePlatformStack(
  app,
  "CommercePlatformStack",
  {
    env: environment,
    description: "Resilient Commerce Platform",

    webRepository: registryStack.webRepository,
    workerRepository: registryStack.workerRepository,

    databaseSecretArn:
      "arn:aws:secretsmanager:us-east-1:345549356290:secret:commerce/production/database-v2-QoEqU5"
  }
);
/*
 * 3. PIPELINE STACK
 */

const pipelineStack = new CommercePipelineStack(
  app,
  "CommercePipelineStack",
  {
    env: environment,
    description: "GitHub CI/CD pipeline for the commerce platform",

    connectionParameterName: "/commerce/github-connection-arn",

    webRepository: registryStack.webRepository,
    workerRepository: registryStack.workerRepository,

    cluster: platformStack.cluster,
    webService: platformStack.webService,
    workerService: platformStack.workerService
  }
);

/*
 * 4. STACK DEPENDENCIES
 */

platformStack.addDependency(registryStack);

pipelineStack.addDependency(platformStack);

/*
 * 5. APPLICATION METADATA
 */

cdk.Tags.of(app).add("Project", "ResilientCommercePlatform");

cdk.Tags.of(app).add("Environment", "Production");