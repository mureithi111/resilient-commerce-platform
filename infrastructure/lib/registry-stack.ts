import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";

export class CommerceRegistryStack extends cdk.Stack {

  public readonly webRepository: ecr.Repository;
  public readonly workerRepository: ecr.Repository;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    this.webRepository = new ecr.Repository(
      this,
      "CommerceWebRepository",
      {
        repositoryName: "commerce-web-images",
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    );

    this.workerRepository = new ecr.Repository(
      this,
      "CommerceWorkerRepository",
      {
        repositoryName: "commerce-worker-images",
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    );

    new cdk.CfnOutput(
      this,
      "WebRepositoryUri",
      {
        value: this.webRepository.repositoryUri,
        description: "ECR repository URI for the commerce web application"
      }
    );

    new cdk.CfnOutput(
      this,
      "WorkerRepositoryUri",
      {
        value: this.workerRepository.repositoryUri,
        description: "ECR repository URI for the commerce worker"
      }
    );
  }
}
