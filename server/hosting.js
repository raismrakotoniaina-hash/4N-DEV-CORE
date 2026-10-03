import crypto from "crypto";
import { query } from "./db.js";

function makeSlug(name, projectId) {
  const base = String(name || "site")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
  return base + "-" + projectId.slice(0, 8);
}

function mapRow(row) {
  return {
    id: row.id, version: row.version, apiKeyId: row.api_key_id,
    projectId: row.project_id, projectName: row.project_name,
    slug: row.slug, status: row.status, files: row.files || [],
    history: row.history || [], createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export async function createDeployment(apiKeyId, project, files) {
  const existingResult = await query(
    `SELECT * FROM deployments WHERE api_key_id = $1 AND project_id = $2 LIMIT 1`,
    [apiKeyId, project.id]
  );
  const existing = existingResult.rows[0] || null;
  const now = new Date();
  const slug = makeSlug(project.name, project.id);
  const version = existing ? (existing.version || 0) + 1 : 1;
  const history = existing ? [...(existing.history || []), {
    version: existing.version || 1, status: existing.status,
    files: existing.files || [], createdAt: existing.updated_at
  }] : [];

  const deployment = {
    id: existing?.id || crypto.randomUUID(), version, apiKeyId,
    projectId: project.id, projectName: project.name, slug,
    status: "deployed",
    files: files.map(file => ({
      path: file.path, content: file.content, encoding: file.encoding || "utf8"
    })),
    history, createdAt: existing?.created_at || now, updatedAt: now
  };

  const result = await query(
    `INSERT INTO deployments
      (id, api_key_id, project_id, project_name, slug, status, version, files, history, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       project_name = EXCLUDED.project_name, slug = EXCLUDED.slug,
       status = EXCLUDED.status, version = EXCLUDED.version,
       files = EXCLUDED.files, history = EXCLUDED.history,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [deployment.id, apiKeyId, project.id, project.name, slug, "deployed",
     version, JSON.stringify(deployment.files), JSON.stringify(history),
     deployment.createdAt, now]
  );
  return mapRow(result.rows[0]);
}

export async function listDeployments(apiKeyId) {
  const result = await query(
    `SELECT id, api_key_id, project_id, project_name, slug, status,
            version, jsonb_array_length(files) AS file_count,
            created_at, updated_at
     FROM deployments WHERE api_key_id = $1 ORDER BY updated_at DESC`,
    [apiKeyId]
  );
  return result.rows.map(row => ({
    id: row.id, version: row.version, apiKeyId: row.api_key_id,
    projectId: row.project_id, projectName: row.project_name,
    slug: row.slug, status: row.status,
    fileCount: Number(row.file_count || 0),
    createdAt: row.created_at, updatedAt: row.updated_at
  }));
}

export async function getDeployment(apiKeyId, deploymentId) {
  const result = await query(
    `SELECT * FROM deployments WHERE id = $1 AND api_key_id = $2 LIMIT 1`,
    [deploymentId, apiKeyId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getPublicDeployment(slug) {
  const result = await query(
    `SELECT * FROM deployments WHERE slug = $1 AND status = 'deployed' LIMIT 1`,
    [slug]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export function findDeploymentFile(deployment, requestedPath) {
  const normalized = String(requestedPath || "")
    .replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!normalized || normalized.endsWith("/")) {
    return deployment.files.find(file => file.path === "index.html") || null;
  }
  const cleanPath = normalized.split("/").filter(Boolean).join("/");
  return deployment.files.find(file => file.path === cleanPath) || null;
}

export async function deleteDeployment(apiKeyId, deploymentId) {
  const result = await query(
    `DELETE FROM deployments WHERE id = $1 AND api_key_id = $2 RETURNING id`,
    [deploymentId, apiKeyId]
  );
  return result.rowCount > 0;
}

export async function listDeploymentHistory(apiKeyId, deploymentId) {
  const deployment = await getDeployment(apiKeyId, deploymentId);
  if (!deployment) return null;
  return (deployment.history || []).map(item => ({
    version: item.version, status: item.status,
    fileCount: Array.isArray(item.files) ? item.files.length : 0,
    createdAt: item.createdAt
  })).sort((a, b) => b.version - a.version);
}

export async function rollbackDeployment(apiKeyId, deploymentId, version) {
  const deployment = await getDeployment(apiKeyId, deploymentId);
  if (!deployment) return null;
  const target = (deployment.history || []).find(item => item.version === version);
  if (!target) return null;

  const now = new Date();
  const currentSnapshot = {
    version: deployment.version || 1, status: deployment.status,
    files: deployment.files, createdAt: now
  };
  const history = [
    ...(deployment.history || []).filter(item => item.version !== version),
    currentSnapshot
  ];

  const result = await query(
    `UPDATE deployments
     SET files = $1::jsonb, version = $2, status = 'deployed',
         updated_at = $3, history = $4::jsonb
     WHERE id = $5 AND api_key_id = $6
     RETURNING *`,
    [JSON.stringify(target.files), (deployment.version || 1) + 1, now,
     JSON.stringify(history), deploymentId, apiKeyId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
