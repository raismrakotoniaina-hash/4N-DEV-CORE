import crypto from "node:crypto";
import { query, isDatabaseConfigured } from "./db.js";

function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    planId: row.plan_id,
    prefix: row.prefix,
    hash: row.hash,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    active: row.active,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
    ...(row.updated_at
      ? {
          updatedAt:
            row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : row.updated_at
        }
      : {})
  };
}

function bootstrapApiKey(key) {
  const bootstrapKey = process.env.CORE_API_KEY;

  if (bootstrapKey && key === bootstrapKey) {
    return {
      id: "core-bootstrap-key",
      name: "4N DEV Core",
      planId: process.env.CORE_API_KEY_PLAN || "pro",
      prefix: key.slice(0, 20),
      scopes: ["chat", "coding", "image", "embeddings"],
      active: true,
      createdAt: "bootstrap"
    };
  }

  return null;
}

export async function createApiKey({
  name = "Developer",
  scopes = ["chat"],
  planId = "free"
} = {}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for API key storage");
  }

  const secret = crypto.randomBytes(32).toString("base64url");
  const key = `4ndev_sk_live_${secret}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const id = crypto.randomUUID();
  const now = new Date();

  const result = await query(
    `INSERT INTO api_keys
      (id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE, $7, $7)
     RETURNING id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at`,
    [id, name, planId, key.slice(0, 20), hash, JSON.stringify(scopes), now]
  );

  return { ...mapRow(result.rows[0]), key };
}

export async function authenticateApiKey(key) {
  if (!key || !key.startsWith("4ndev_sk_")) return null;

  const bootstrap = bootstrapApiKey(key);
  if (bootstrap) return bootstrap;

  if (!isDatabaseConfigured()) return null;

  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const result = await query(
    `SELECT id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at
     FROM api_keys
     WHERE hash = $1 AND active = TRUE
     LIMIT 1`,
    [hash]
  );

  return mapRow(result.rows[0]);
}

export async function listApiKeys(apiKeyId = null) {
  if (!isDatabaseConfigured()) return [];

  const params = [];
  let sql = `SELECT id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at
              FROM api_keys
              WHERE active = TRUE`;

  if (apiKeyId) {
    params.push(apiKeyId);
    sql += " AND id = $1";
  }

  sql += " ORDER BY created_at DESC";

  const result = await query(sql, params);
  return result.rows.map(mapRow);
}

export async function setApiKeyActive(apiKeyId, active) {
  if (!apiKeyId || typeof active !== "boolean" || !isDatabaseConfigured()) {
    return null;
  }

  const result = await query(
    `UPDATE api_keys
     SET active = $1, updated_at = $2
     WHERE id = $3
     RETURNING id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at`,
    [active, new Date(), apiKeyId]
  );

  return mapRow(result.rows[0]);
}

export async function updateApiKeyPlan(apiKeyId, planId) {
  if (!apiKeyId || !planId || !isDatabaseConfigured()) return null;

  const result = await query(
    `UPDATE api_keys
     SET plan_id = $1, updated_at = $2
     WHERE id = $3 AND active = TRUE
     RETURNING id, name, plan_id, prefix, hash, scopes, active, created_at, updated_at`,
    [planId, new Date(), apiKeyId]
  );

  return mapRow(result.rows[0]);
}
