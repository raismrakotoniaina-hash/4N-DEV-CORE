import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isDatabaseConfigured, query } from "./db.js";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "projects.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}

function readProjects() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeProjects(projects) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), "utf8");
}

function mapProject(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createProject(apiKeyId, name, description = "") {
  const now = new Date().toISOString();

  if (isDatabaseConfigured()) {
    const project = {
      id: crypto.randomUUID(),
      apiKeyId,
      name,
      description,
      createdAt: now,
      updatedAt: now
    };

    await query(
      `INSERT INTO projects (id, api_key_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [project.id, project.apiKeyId, project.name, project.description, project.createdAt, project.updatedAt]
    );

    return project;
  }

  const projects = readProjects();
  const project = {
    id: crypto.randomUUID(),
    apiKeyId,
    name,
    description,
    createdAt: now,
    updatedAt: now
  };
  projects.push(project);
  writeProjects(projects);
  return project;
}

export async function listProjects(apiKeyId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      `SELECT id, api_key_id, name, description, created_at, updated_at
       FROM projects WHERE api_key_id = $1 ORDER BY created_at DESC`,
      [apiKeyId]
    );
    return result.rows.map(mapProject);
  }

  return readProjects().filter(project => project.apiKeyId === apiKeyId);
}

export async function getProject(apiKeyId, projectId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      `SELECT id, api_key_id, name, description, created_at, updated_at
       FROM projects WHERE id = $1 AND api_key_id = $2 LIMIT 1`,
      [projectId, apiKeyId]
    );
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  }

  return readProjects().find(
    project => project.id === projectId && project.apiKeyId === apiKeyId
  ) || null;
}

export async function updateProject(apiKeyId, projectId, fields = {}) {
  const allowed = {};
  if (typeof fields.name === "string") allowed.name = fields.name;
  if (typeof fields.description === "string") allowed.description = fields.description;

  if (isDatabaseConfigured()) {
    const result = await query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = $3
       WHERE id = $4 AND api_key_id = $5
       RETURNING id, api_key_id, name, description, created_at, updated_at`,
      [
        allowed.name ?? null,
        allowed.description ?? null,
        new Date().toISOString(),
        projectId,
        apiKeyId
      ]
    );
    return result.rows[0] ? mapProject(result.rows[0]) : null;
  }

  const projects = readProjects();
  const index = projects.findIndex(
    project => project.id === projectId && project.apiKeyId === apiKeyId
  );
  if (index === -1) return null;

  projects[index] = {
    ...projects[index],
    ...allowed,
    updatedAt: new Date().toISOString()
  };
  writeProjects(projects);
  return projects[index];
}

export async function deleteProject(apiKeyId, projectId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      "DELETE FROM projects WHERE id = $1 AND api_key_id = $2 RETURNING id",
      [projectId, apiKeyId]
    );
    return result.rowCount > 0;
  }

  const projects = readProjects();
  const project = projects.find(
    item => item.id === projectId && item.apiKeyId === apiKeyId
  );
  if (!project) return false;
  writeProjects(projects.filter(item => item.id !== projectId));
  return true;
}
