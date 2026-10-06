import crypto from "crypto";
import { query, isDatabaseConfigured } from "./db.js";
import { readStore, updateStore } from "./localStore.js";

function mapProject(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id ?? row.apiKeyId,
    name: row.name,
    description: row.description,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

export async function createProject(apiKeyId, name, description = "") {
  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    apiKeyId,
    name,
    description,
    createdAt: now,
    updatedAt: now
  };

  if (!isDatabaseConfigured()) {
    await updateStore((state) => ({
      ...state,
      projects: [...state.projects, project]
    }));
    return project;
  }

  await query(
    `INSERT INTO projects (id, api_key_id, name, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [project.id, project.apiKeyId, project.name, project.description, project.createdAt, project.updatedAt]
  );

  return project;
}

export async function listProjects(apiKeyId) {
  if (!isDatabaseConfigured()) {
    const state = await readStore();
    return state.projects
      .filter((project) => project.apiKeyId === apiKeyId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(mapProject);
  }

  const result = await query(
    `SELECT id, api_key_id, name, description, created_at, updated_at
     FROM projects WHERE api_key_id = $1 ORDER BY created_at DESC`,
    [apiKeyId]
  );
  return result.rows.map(mapProject);
}

export async function getProject(apiKeyId, projectId) {
  if (!isDatabaseConfigured()) {
    const state = await readStore();
    return mapProject(state.projects.find(
      (project) => project.id === projectId && project.apiKeyId === apiKeyId
    ));
  }

  const result = await query(
    `SELECT id, api_key_id, name, description, created_at, updated_at
     FROM projects WHERE id = $1 AND api_key_id = $2 LIMIT 1`,
    [projectId, apiKeyId]
  );
  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function updateProject(apiKeyId, projectId, fields = {}) {
  const allowed = {};
  if (typeof fields.name === "string") allowed.name = fields.name;
  if (typeof fields.description === "string") allowed.description = fields.description;

  if (!isDatabaseConfigured()) {
    let updated = null;
    await updateStore((state) => {
      const existing = state.projects.find(
        (project) => project.id === projectId && project.apiKeyId === apiKeyId
      );
      if (!existing) return state;

      updated = {
        ...existing,
        ...(allowed.name !== undefined ? { name: allowed.name } : {}),
        ...(allowed.description !== undefined ? { description: allowed.description } : {}),
        updatedAt: new Date().toISOString()
      };

      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === projectId ? updated : project
        )
      };
    });
    return mapProject(updated);
  }

  const result = await query(
    `UPDATE projects
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         updated_at = $3
     WHERE id = $4 AND api_key_id = $5
     RETURNING id, api_key_id, name, description, created_at, updated_at`,
    [allowed.name ?? null, allowed.description ?? null, new Date().toISOString(), projectId, apiKeyId]
  );
  return result.rows[0] ? mapProject(result.rows[0]) : null;
}

export async function deleteProject(apiKeyId, projectId) {
  if (!isDatabaseConfigured()) {
    let deleted = false;
    await updateStore((state) => {
      const exists = state.projects.some(
        (project) => project.id === projectId && project.apiKeyId === apiKeyId
      );
      if (!exists) return state;

      deleted = true;
      return {
        ...state,
        projects: state.projects.filter((project) => project.id !== projectId),
        projectFiles: state.projectFiles.filter((file) =>
          !(file.projectId === projectId && file.apiKeyId === apiKeyId)
        )
      };
    });
    return deleted;
  }

  const result = await query(
    "DELETE FROM projects WHERE id = $1 AND api_key_id = $2 RETURNING id",
    [projectId, apiKeyId]
  );
  return result.rowCount > 0;
}
