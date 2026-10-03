import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isDatabaseConfigured, query } from "./db.js";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "project-files.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}

function readFiles() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFiles(files) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(files, null, 2), "utf8");
}

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
  if (isDatabaseConfigured()) {
    const result = await query(
      `SELECT id, api_key_id, project_id, path, content, created_at, updated_at
       FROM project_files
       WHERE api_key_id = $1 AND project_id = $2
       ORDER BY path ASC`,
      [apiKeyId, projectId]
    );
    return result.rows.map(mapFile);
  }

  return readFiles().filter(file => file.apiKeyId === apiKeyId && file.projectId === projectId);
}

export async function getFile(apiKeyId, projectId, fileId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      `SELECT id, api_key_id, project_id, path, content, created_at, updated_at
       FROM project_files
       WHERE id = $1 AND api_key_id = $2 AND project_id = $3
       LIMIT 1`,
      [fileId, apiKeyId, projectId]
    );
    return result.rows[0] ? mapFile(result.rows[0]) : null;
  }

  return readFiles().find(
    file => file.id === fileId && file.apiKeyId === apiKeyId && file.projectId === projectId
  ) || null;
}

export async function upsertFile(apiKeyId, projectId, filePath, content) {
  const now = new Date().toISOString();

  if (isDatabaseConfigured()) {
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

  const files = readFiles();
  const existingIndex = files.findIndex(
    file => file.apiKeyId === apiKeyId &&
      file.projectId === projectId &&
      file.path === filePath
  );

  if (existingIndex >= 0) {
    files[existingIndex] = {
      ...files[existingIndex],
      content,
      updatedAt: now
    };
    writeFiles(files);
    return files[existingIndex];
  }

  const file = {
    id: crypto.randomUUID(),
    apiKeyId,
    projectId,
    path: filePath,
    content,
    createdAt: now,
    updatedAt: now
  };

  files.push(file);
  writeFiles(files);
  return file;
}

export async function deleteFile(apiKeyId, projectId, fileId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      "DELETE FROM project_files WHERE id = $1 AND api_key_id = $2 AND project_id = $3 RETURNING id",
      [fileId, apiKeyId, projectId]
    );
    return result.rowCount > 0;
  }

  const files = readFiles();
  const index = files.findIndex(
    file => file.id === fileId &&
      file.apiKeyId === apiKeyId &&
      file.projectId === projectId
  );
  if (index === -1) return false;

  files.splice(index, 1);
  writeFiles(files);
  return true;
}
