const express = require("express");
const { randomUUID } = require("crypto");

const {
  initializeDatabase,
  getOrder,
  closeDatabase
} = require("./database");

const {
  connectCache,
  getCachedOrder,
  cacheOrder,
  closeCache
} = require("./cache");

const { enqueueOrder } = require("./queue");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    application: "Resilient Commerce API",
    version: "1.0.0",
    status: "running"
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "healthy"
  });
});

app.post("/orders", async (req, res) => {
  try {
    const { items, customerId } = req.body;

    if (
      !customerId ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "customerId and non-empty items are required"
      });
    }

    const order = {
      id: randomUUID(),
      customerId,
      items,
      createdAt: new Date().toISOString()
    };

    await enqueueOrder(order);

    res.status(202).json({
      message: "Order accepted for asynchronous processing",
      orderId: order.id,
      status: "QUEUED"
    });

  } catch (error) {
    console.error("Order submission failed:", error);

    res.status(503).json({
      error: "Order processing is temporarily unavailable"
    });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const cached = await getCachedOrder(req.params.id);

    if (cached) {
      return res.json({
        source: "redis",
        order: cached
      });
    }

    const order = await getOrder(req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    await cacheOrder(req.params.id, order);

    res.json({
      source: "postgresql",
      order
    });

  } catch (error) {
    console.error("Order retrieval failed:", error);

    res.status(500).json({
      error: "Unable to retrieve order"
    });
  }
});

const port = Number(process.env.PORT || 3000);

let server;

async function start() {
  await initializeDatabase();

  try {
    await connectCache();
    console.log("Redis connection established");
  } catch (error) {
    console.error("Redis unavailable:", error.message);
    console.log("Continuing without cache");
  }

  server = app.listen(port, "0.0.0.0", () => {
    console.log(`Commerce API listening on port ${port}`);
  });
}

async function shutdown() {
  console.log("Shutting down web application");

  if (server) {
    await new Promise(resolve => server.close(resolve));
  }

  await closeCache();
  await closeDatabase();

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start().catch(error => {
  console.error("Application startup failed:", error);
  process.exit(1);
});
