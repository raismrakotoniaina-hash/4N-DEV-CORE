import pg from "pg";

const { Pool } = pg;

let pool = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getDb().query(text, params);
}

export async function checkDatabase() {
  const result = await query("SELECT NOW() AS now");
  return result.rows[0];
}
