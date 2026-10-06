import crypto from "node:crypto";
import { query, isDatabaseConfigured } from "./db.js";
import { readStore, updateStore } from "./localStore.js";

export async function recordUsage({ apiKeyId, endpoint, usage }) {
  const record = {
    id: crypto.randomUUID(),
    apiKeyId,
    endpoint,
    usage: usage ?? {},
    createdAt: new Date().toISOString()
  };

  if (!isDatabaseConfigured()) {
    await updateStore((state) => ({
      ...state,
      usageRecords: [...state.usageRecords, record]
    }));
    return record;
  }

  await query(
    `INSERT INTO usage_records (id, api_key_id, endpoint, usage, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [record.id, apiKeyId, endpoint, JSON.stringify(record.usage), new Date(record.createdAt)]
  );

  return record;
}

export async function getUsage(apiKeyId) {
  if (!isDatabaseConfigured()) {
    const state = await readStore();
    return state.usageRecords
      .filter((record) => record.apiKeyId === apiKeyId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

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
