const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const {
  initializeDatabase,
  processOrder,
  closeDatabase
} = require("./processor");

const sqs = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1"
});

const queueUrl = process.env.ORDER_QUEUE_URL;

let running = true;

async function pollQueue() {
  while (running) {
    try {
      const result = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 120
        })
      );

      for (const message of result.Messages || []) {
        try {
          const order = JSON.parse(message.Body);

          await processOrder(order);

          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: message.ReceiptHandle
            })
          );

        } catch (error) {
          console.error("Message processing failed:", error.message);
        }
      }

    } catch (error) {
      console.error("Queue polling failed:", error.message);

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function shutdown() {
  console.log("Worker shutdown requested");

  running = false;

  await closeDatabase();

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function start() {
  if (!queueUrl) {
    throw new Error("ORDER_QUEUE_URL is required");
  }

  await initializeDatabase();

  console.log("Commerce worker started");

  await pollQueue();
}

start().catch(error => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
