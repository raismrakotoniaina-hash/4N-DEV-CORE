import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
const usagePath = path.join(dataDir, "usage.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(usagePath)) {
    fs.writeFileSync(usagePath, "[]", "utf8");
  }
}

function readUsage() {
  ensureStore();
  return JSON.parse(fs.readFileSync(usagePath, "utf8"));
}

function writeUsage(records) {
  ensureStore();
  fs.writeFileSync(usagePath, JSON.stringify(records, null, 2), "utf8");
}

export function recordUsage({ apiKeyId, endpoint, usage }) {
  const records = readUsage();

  records.push({
    id: crypto.randomUUID(),
    apiKeyId,
    endpoint,
    usage,
    createdAt: new Date().toISOString()
  });

  writeUsage(records);
}

export function getUsage(apiKeyId) {
  return readUsage().filter((item) => item.apiKeyId === apiKeyId);
}
