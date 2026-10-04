import crypto from "crypto";
import { query } from "./db.js";

function mapFile(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    projectId: row.project_id,
    path: row.path,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listFiles(apiKeyId, projectId) {
  const result = await query(
    `SELECT id, api_key_id, project_id, path, content, created_at, updated_at
     FROM project_files
     WHERE api_key_id = $1 AND project_id = $2
     ORDER BY path ASC`,
    [apiKeyId, projectId]
  );
  return result.rows.map(mapFile);
}

export async function getFile(apiKeyId, projectId, fileId) {
  const result = await query(
    `SELECT id, api_key_id, project_id, path, content, created_at, updated_at
     FROM project_files
     WHERE id = $1 AND api_key_id = $2 AND project_id = $3
     LIMIT 1`,
    [fileId, apiKeyId, projectId]
  );
  return result.rows[0] ? mapFile(result.rows[0]) : null;
}

export async function upsertFile(apiKeyId, projectId, filePath, content) {
  const now = new Date().toISOString();
  const result = await query(
    `INSERT INTO project_files
     (id, api_key_id, project_id, path, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (project_id, path)
     DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at
     RETURNING id, api_key_id, project_id, path, content, created_at, updated_at`,
    [crypto.randomUUID(), apiKeyId, projectId, filePath, content, now]
  );
  return mapFile(result.rows[0]);
}

export async function deleteFile(apiKeyId, projectId, fileId) {
  const result = await query(
    "DELETE FROM project_files WHERE id = $1 AND api_key_id = $2 AND project_id = $3 RETURNING id",
    [fileId, apiKeyId, projectId]
  );
  return result.rowCount > 0;
}
