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
    version: existing >= 0
      ? (deployments[existing].version || 0) + 1
      : 1,
    apiKeyId,
    projectId: project.id,
    projectName: project.name,
    slug,
    status: "deployed",
    files: files.map(file => ({
      path: file.path,
      content: file.content
    })),
    history: existing >= 0
      ? [
          ...(deployments[existing].history || []),
          {
            version: deployments[existing].version || 1,
            status: deployments[existing].status,
            files: deployments[existing].files,
            createdAt: deployments[existing].updatedAt
          }
        ]
      : [],
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


export function listDeploymentHistory(apiKeyId, deploymentId) {
  const deployment = getDeployment(apiKeyId, deploymentId);
  if (!deployment) return null;

  return (deployment.history || [])
    .map(item => ({
      version: item.version,
      status: item.status,
      fileCount: item.files.length,
      createdAt: item.createdAt
    }))
    .sort((a, b) => b.version - a.version);
}

export function rollbackDeployment(apiKeyId, deploymentId, version) {
  const deployments = readDeployments();
  const index = deployments.findIndex(
    item => item.id === deploymentId && item.apiKeyId === apiKeyId
  );
  if (index === -1) return null;

  const deployment = deployments[index];
  const target = (deployment.history || []).find(item => item.version === version);
  if (!target) return null;

  const now = new Date().toISOString();
  const currentSnapshot = {
    version: deployment.version || 1,
    status: deployment.status,
    files: deployment.files,
    createdAt: now
  };

  const history = [
    ...(deployment.history || []).filter(item => item.version !== version),
    currentSnapshot
  ];

  deployment.files = target.files;
  deployment.version = (deployment.version || 1) + 1;
  deployment.status = "deployed";
  deployment.updatedAt = now;
  deployment.history = history;

  deployments[index] = deployment;
  writeDeployments(deployments);
  return deployment;
}
