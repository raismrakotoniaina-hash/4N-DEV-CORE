import fs from "fs";
import path from "path";
import crypto from "crypto";

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

export function createProject(apiKeyId, name, description = "") {
  const projects = readProjects();
  const now = new Date().toISOString();
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

export function listProjects(apiKeyId) {
  return readProjects().filter(project => project.apiKeyId === apiKeyId);
}

export function getProject(apiKeyId, projectId) {
  return readProjects().find(
    project => project.id === projectId && project.apiKeyId === apiKeyId
  ) || null;
}

export function updateProject(apiKeyId, projectId, fields = {}) {
  const projects = readProjects();
  const index = projects.findIndex(
    project => project.id === projectId && project.apiKeyId === apiKeyId
  );
  if (index === -1) return null;

  const allowed = {};
  if (typeof fields.name === "string") allowed.name = fields.name;
  if (typeof fields.description === "string") allowed.description = fields.description;

  projects[index] = {
    ...projects[index],
    ...allowed,
    updatedAt: new Date().toISOString()
  };
  writeProjects(projects);
  return projects[index];
}

export function deleteProject(apiKeyId, projectId) {
  const projects = readProjects();
  const project = projects.find(
    item => item.id === projectId && item.apiKeyId === apiKeyId
  );
  if (!project) return false;
  writeProjects(projects.filter(item => item.id !== projectId));
  return true;
}
