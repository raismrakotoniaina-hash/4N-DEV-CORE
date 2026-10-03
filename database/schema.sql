CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_api_key
  ON projects(api_key_id);

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_project_files_project
  ON project_files(project_id);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  usage JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_api_key
  ON usage_records(api_key_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  scopes JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ
);
