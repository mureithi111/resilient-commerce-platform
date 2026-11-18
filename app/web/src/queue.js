const {
  SQSClient,
  SendMessageCommand
} = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1"
});

async function enqueueOrder(order) {
  if (!process.env.ORDER_QUEUE_URL) {
    throw new Error("ORDER_QUEUE_URL is not configured");
  }

  const command = new SendMessageCommand({
    QueueUrl: process.env.ORDER_QUEUE_URL,
    MessageBody: JSON.stringify(order)
  });

  return sqs.send(command);
}

module.exports = { enqueueOrder };
