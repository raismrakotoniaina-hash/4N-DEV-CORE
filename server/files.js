import crypto from "crypto";
import { query, isDatabaseConfigured } from "./db.js";
import { readStore, updateStore } from "./localStore.js";

function mapFile(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id ?? row.apiKeyId,
    projectId: row.project_id ?? row.projectId,
    path: row.path,
    content: row.content,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

export async function listFiles(apiKeyId, projectId) {
  if (!isDatabaseConfigured()) {
    const state = await readStore();
    return state.projectFiles
      .filter((file) => file.apiKeyId === apiKeyId && file.projectId === projectId)
      .sort((a, b) => String(a.path).localeCompare(String(b.path)))
      .map(mapFile);
  }

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
  if (!isDatabaseConfigured()) {
    const state = await readStore();
    return mapFile(state.projectFiles.find(
      (file) => file.id === fileId && file.apiKeyId === apiKeyId && file.projectId === projectId
    ));
  }

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

  if (!isDatabaseConfigured()) {
    let saved = null;
    await updateStore((state) => {
      const existing = state.projectFiles.find(
        (file) => file.apiKeyId === apiKeyId && file.projectId === projectId && file.path === filePath
      );

      saved = existing
        ? { ...existing, content, updatedAt: now }
        : {
            id: crypto.randomUUID(),
            apiKeyId,
            projectId,
            path: filePath,
            content,
            createdAt: now,
            updatedAt: now
          };

      return {
        ...state,
        projectFiles: existing
          ? state.projectFiles.map((file) => file.id === existing.id ? saved : file)
          : [...state.projectFiles, saved]
      };
    });
    return saved;
  }

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
  if (!isDatabaseConfigured()) {
    let deleted = false;
    await updateStore((state) => {
      const exists = state.projectFiles.some(
        (file) => file.id === fileId && file.apiKeyId === apiKeyId && file.projectId === projectId
      );
      if (!exists) return state;

      deleted = true;
      return {
        ...state,
        projectFiles: state.projectFiles.filter((file) => file.id !== fileId)
      };
    });
    return deleted;
  }

  const result = await query(
    "DELETE FROM project_files WHERE id = $1 AND api_key_id = $2 AND project_id = $3 RETURNING id",
    [fileId, apiKeyId, projectId]
  );
  return result.rowCount > 0;
}
