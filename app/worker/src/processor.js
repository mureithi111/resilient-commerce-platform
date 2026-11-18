const fs = require('node:fs');
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "commerce",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: {
  ca: fs.readFileSync('/app/certs/global-bundle.pem', 'utf8'),
  rejectUnauthorized: true
},

  max: 5,
  connectionTimeoutMillis: 5000,
  
  
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY,
      order_data JSONB NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function processOrder(order) {
  if (!order.id || !order.customerId || !Array.isArray(order.items)) {
    throw new Error("Invalid order message");
  }

  await pool.query(
    `INSERT INTO orders (id, order_data, status)
     VALUES ($1, $2, 'COMPLETED')
     ON CONFLICT (id)
     DO UPDATE SET status = 'COMPLETED'`,
    [order.id, order]
  );

  console.log("Successfully processed order:", order.id);
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  initializeDatabase,
  processOrder,
  closeDatabase
};
