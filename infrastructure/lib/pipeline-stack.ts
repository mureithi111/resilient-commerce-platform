import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";

interface CommercePipelineStackProps extends cdk.StackProps {
  connectionParameterName: string;

  webRepository: ecr.IRepository;
  workerRepository: ecr.IRepository;

  cluster: ecs.ICluster;

  webService: ecs.IBaseService;
  workerService: ecs.IBaseService;
}

export class CommercePipelineStack extends cdk.Stack {

  constructor(
    scope: Construct,
    id: string,
    props: CommercePipelineStackProps
  ) {
    super(scope, id, props);

    /*
     * 1. GITHUB CONNECTION
     *
     * Resolve the GitHub CodeStar Connection ARN
     * from AWS Systems Manager Parameter Store.
     */

    const connectionArn =
      ssm.StringParameter.valueForStringParameter(
        this,
        props.connectionParameterName
      );

    /*
     * 2. CODEBUILD PROJECT
     */

    const buildProject = new codebuild.PipelineProject(
      this,
      "CommerceBuildProject",
      {
        projectName: "commerce-container-build",

        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: true
        },

        environmentVariables: {
          AWS_REGION: {
            value: this.region
          },

          AWS_ACCOUNT_ID: {
            value: this.account
          },

          WEB_REPOSITORY: {
            value: props.webRepository.repositoryName
          },

          WORKER_REPOSITORY: {
            value: props.workerRepository.repositoryName
          }
        },

        buildSpec: codebuild.BuildSpec.fromSourceFilename(
          "pipeline/buildspec.yml"
        )
      }
    );

    /*
     * 3. ECR PERMISSIONS
     */

    props.webRepository.grantPullPush(buildProject);

    props.workerRepository.grantPullPush(buildProject);

    /*
     * 4. ECS DEPLOYMENT PERMISSIONS
     */

    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:DescribeClusters"
        ],
        resources: ["*"]
      })
    );

    /*
     * 5. PIPELINE ARTIFACTS
     */

    const sourceOutput = new codepipeline.Artifact(
      "CommerceSourceArtifact"
    );

    const buildOutput = new codepipeline.Artifact(
      "CommerceBuildArtifact"
    );

    /*
     * 6. CODEPIPELINE
     */

    const pipeline = new codepipeline.Pipeline(
      this,
      "CommerceDeliveryPipeline",
      {
        pipelineName: "commerce-delivery-pipeline",

        pipelineType: codepipeline.PipelineType.V2,

        restartExecutionOnUpdate: true
      }
    );

    /*
     * 7. SOURCE STAGE
     */

    pipeline.addStage({
      stageName: "Source",

      actions: [
        new actions.CodeStarConnectionsSourceAction({
          actionName: "GitHubSource",

          owner: "mureithi111",

          repo: "resilient-commerce-platform",

          branch: "main",

          connectionArn: connectionArn,

          output: sourceOutput
        })
      ]
    });

    /*
     * 8. BUILD STAGE
     */

    pipeline.addStage({
      stageName: "Build",

      actions: [
        new actions.CodeBuildAction({
          actionName: "BuildAndPushImages",

          project: buildProject,

          input: sourceOutput,

          outputs: [buildOutput]
        })
      ]
    });

  

      /*
     * 9. WEB APPLICATION DEPLOYMENT
     */

    pipeline.addStage({
      stageName: "DeployWeb",
      actions: [
        new actions.EcsDeployAction({
          actionName: "DeployCommerceWeb",
          service: props.webService,
          imageFile: buildOutput.atPath("imagedefinitions-web.json")
        })
      ]
    });

 
    /*
     * 10. WORKER DEPLOYMENT
     */

    pipeline.addStage({
      stageName: "DeployWorker",
      actions: [
        new actions.EcsDeployAction({
          actionName: "DeployCommerceWorker",
          service: props.workerService,
          imageFile: buildOutput.atPath("imagedefinitions-worker.json")
        })
      ]
    });


    

  }
}