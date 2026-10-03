import { query } from "./db.js";

let initialized = false;

export async function ensureDeploymentsTable() {
  if (initialized) return;

  await query(`
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
  `);

  initialized = true;
}
