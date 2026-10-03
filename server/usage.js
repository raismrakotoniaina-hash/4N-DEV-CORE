import crypto from "node:crypto";
import { query, isDatabaseConfigured } from "./db.js";

export async function recordUsage({ apiKeyId, endpoint, usage }) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for usage storage");
  }

  await query(
    `INSERT INTO usage_records (id, api_key_id, endpoint, usage, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [crypto.randomUUID(), apiKeyId, endpoint, JSON.stringify(usage ?? {}), new Date()]
  );
}

export async function getUsage(apiKeyId) {
  if (!isDatabaseConfigured()) return [];

  const result = await query(
    `SELECT id, api_key_id, endpoint, usage, created_at
     FROM usage_records
     WHERE api_key_id = $1
     ORDER BY created_at DESC`,
    [apiKeyId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    apiKeyId: row.api_key_id,
    endpoint: row.endpoint,
    usage: row.usage,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at
  }));
}
