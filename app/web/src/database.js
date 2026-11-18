const { Pool } = require("pg");
const fs = require('fs');

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

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000

  

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

async function createOrder(order) {
  await pool.query(
    `INSERT INTO orders (id, order_data, status)
     VALUES ($1, $2, 'PROCESSING')
     ON CONFLICT (id) DO NOTHING`,
    [order.id, order]
  );
}

async function getOrder(id) {
  const result = await pool.query(
    "SELECT id, order_data, status, created_at FROM orders WHERE id = $1",
    [id]
  );

  return result.rows[0] || null;
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  initializeDatabase,
  createOrder,
  getOrder,
  closeDatabase
};
