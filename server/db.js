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

export async function initializeDatabase() {
  if (!isDatabaseConfigured()) return false;

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_api_key
      ON projects(api_key_id);

    CREATE TABLE IF NOT EXISTS project_files (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(project_id, path)
    );

    CREATE INDEX IF NOT EXISTS idx_project_files_project
      ON project_files(project_id);

    CREATE INDEX IF NOT EXISTS idx_project_files_api_key
      ON project_files(api_key_id);

    CREATE TABLE IF NOT EXISTS credit_accounts (
      api_key_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_credit_transactions_api_key
      ON credit_transactions(api_key_id);

    CREATE TABLE IF NOT EXISTS usage_records (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      usage JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_api_key
      ON usage_records(api_key_id);

    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      prefix TEXT NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      scopes JSONB NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS builds (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      entrypoint TEXT NOT NULL,
      files JSONB NOT NULL,
      file_count INTEGER NOT NULL,
      total_characters INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_builds_api_key
      ON builds(api_key_id);

    CREATE INDEX IF NOT EXISTS idx_builds_project
      ON builds(project_id);

    CREATE TABLE IF NOT EXISTS deployments (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      files JSONB NOT NULL,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_api_key
      ON deployments(api_key_id);

    CREATE INDEX IF NOT EXISTS idx_deployments_project
      ON deployments(project_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_api_project
      ON deployments(api_key_id, project_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_slug
      ON deployments(slug);

    CREATE TABLE IF NOT EXISTS billing_orders (
      id UUID PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_billing_orders_api_key
      ON billing_orders(api_key_id);

    CREATE TABLE IF NOT EXISTS billing_payments (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES billing_orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_reference TEXT,
      notification_token TEXT,
      checkout_url TEXT,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_billing_payments_order
      ON billing_payments(order_id);

    CREATE INDEX IF NOT EXISTS idx_billing_payments_provider_reference
      ON billing_payments(provider_reference);
  `);

  return true;
}
