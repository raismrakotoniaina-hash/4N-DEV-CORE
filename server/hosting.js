import crypto from "crypto";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "deployments.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}

function readDeployments() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeDeployments(deployments) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(deployments, null, 2), "utf8");
}

function makeSlug(name, projectId) {
  const base = String(name || "site")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
  return `${base}-${projectId.slice(0, 8)}`;
}

export function createDeployment(apiKeyId, project, files) {
  const deployments = readDeployments();
  const now = new Date().toISOString();
  const slug = makeSlug(project.name, project.id);

  const existing = deployments.findIndex(
    item => item.apiKeyId === apiKeyId && item.projectId === project.id
  );

  const deployment = {
    id: existing >= 0 ? deployments[existing].id : crypto.randomUUID(),
    apiKeyId,
    projectId: project.id,
    projectName: project.name,
    slug,
    status: "deployed",
    files: files.map(file => ({
      path: file.path,
      content: file.content
    })),
    createdAt: existing >= 0 ? deployments[existing].createdAt : now,
    updatedAt: now
  };

  if (existing >= 0) deployments[existing] = deployment;
  else deployments.push(deployment);

  writeDeployments(deployments);
  return deployment;
}

export function listDeployments(apiKeyId) {
  return readDeployments()
    .filter(item => item.apiKeyId === apiKeyId)
    .map(({ files, ...deployment }) => ({
      ...deployment,
      fileCount: files.length
    }));
}

export function getDeployment(apiKeyId, deploymentId) {
  return readDeployments().find(
    item => item.id === deploymentId && item.apiKeyId === apiKeyId
  ) || null;
}

export function getPublicDeployment(slug) {
  return readDeployments().find(
    item => item.slug === slug && item.status === "deployed"
  ) || null;
}

export function findDeploymentFile(deployment, requestedPath) {
  const normalized = String(requestedPath || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  if (!normalized || normalized.endsWith("/")) {
    return deployment.files.find(file => file.path === "index.html") || null;
  }

  const cleanPath = normalized.split("/").filter(Boolean).join("/");
  return deployment.files.find(file => file.path === cleanPath) || null;
}


export function deleteDeployment(apiKeyId, deploymentId) {
  const deployments = readDeployments();
  const index = deployments.findIndex(
    item => item.id === deploymentId && item.apiKeyId === apiKeyId
  );
  if (index === -1) return false;

  deployments.splice(index, 1);
  writeDeployments(deployments);
  return true;
}
