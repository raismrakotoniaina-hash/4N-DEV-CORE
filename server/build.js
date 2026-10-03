import crypto from "crypto";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "builds.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}

function readBuilds() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeBuilds(builds) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(builds, null, 2), "utf8");
}

export function buildProject(apiKeyId, project, files) {
  const validFiles = files.filter(file =>
    file &&
    typeof file.path === "string" &&
    typeof file.content === "string" &&
    file.path &&
    !file.path.startsWith("/") &&
    !file.path.includes("..") &&
    file.content.length <= 200000
  );

  if (!validFiles.some(file => file.path === "index.html")) {
    const error = new Error("Build requires index.html");
    error.statusCode = 400;
    throw error;
  }

  const totalCharacters = validFiles.reduce((sum, file) => sum + file.content.length, 0);
  if (validFiles.length > 100 || totalCharacters > 1000000) {
    const error = new Error("Build output exceeds project limits");
    error.statusCode = 413;
    throw error;
  }

  const now = new Date().toISOString();
  const build = {
    id: crypto.randomUUID(),
    apiKeyId,
    projectId: project.id,
    projectName: project.name,
    type: "static",
    status: "built",
    entrypoint: "index.html",
    files: validFiles.map(file => ({
      path: file.path,
      content: file.content
    })),
    fileCount: validFiles.length,
    totalCharacters,
    createdAt: now,
    updatedAt: now
  };

  const builds = readBuilds();
  builds.push(build);
  writeBuilds(builds);
  return build;
}

export function getBuild(apiKeyId, buildId) {
  return readBuilds().find(
    build => build.id === buildId && build.apiKeyId === apiKeyId
  ) || null;
}

export function listBuilds(apiKeyId, projectId = null) {
  return readBuilds()
    .filter(build => build.apiKeyId === apiKeyId && (!projectId || build.projectId === projectId))
    .map(({ files, ...build }) => build)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
