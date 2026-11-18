const { createClient } = require("redis");

let client;

async function connectCache() {
  if (!process.env.REDIS_HOST) {
    return null;
  }

  client = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      tls: process.env.REDIS_TLS === "true",
      reconnectStrategy: retries => Math.min(retries * 500, 5000)
    }
  });

  client.on("error", error => {
    console.error("Redis connection error:", error.message);
  });

  await client.connect();

  return client;
}

async function getCachedOrder(id) {
  if (!client || !client.isReady) return null;

  const value = await client.get(`order:${id}`);

  return value ? JSON.parse(value) : null;
}

async function cacheOrder(id, order) {
  if (!client || !client.isReady) return;

  await client.set(
    `order:${id}`,
    JSON.stringify(order),
    { EX: 300 }
  );
}

async function closeCache() {
  if (client && client.isOpen) {
    await client.quit();
  }
}

module.exports = {
  connectCache,
  getCachedOrder,
  cacheOrder,
  closeCache
};
