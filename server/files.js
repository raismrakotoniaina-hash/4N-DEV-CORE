import fs from "fs";
import path from "path";
import crypto from "crypto";

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

export function listFiles(apiKeyId, projectId) {
  return readFiles().filter(file => file.apiKeyId === apiKeyId && file.projectId === projectId);
}

export function getFile(apiKeyId, projectId, fileId) {
  return readFiles().find(
    file => file.id === fileId && file.apiKeyId === apiKeyId && file.projectId === projectId
  ) || null;
}

export function upsertFile(apiKeyId, projectId, filePath, content) {
  const files = readFiles();
  const existingIndex = files.findIndex(
    file => file.apiKeyId === apiKeyId &&
      file.projectId === projectId &&
      file.path === filePath
  );

  const now = new Date().toISOString();

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

export function deleteFile(apiKeyId, projectId, fileId) {
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
