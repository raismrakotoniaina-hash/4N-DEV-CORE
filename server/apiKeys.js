import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
const storePath = path.join(dataDir, "api-keys.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, "[]", "utf8");
  }
}

function readKeys() {
  ensureStore();
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

function writeKeys(keys) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(keys, null, 2), "utf8");
}

export function createApiKey({
  name = "Developer",
  scopes = ["chat"],
  planId = "free"
} = {}) {
  const secret = crypto.randomBytes(32).toString("base64url");
  const key = `4ndev_sk_live_${secret}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");

  const record = {
    id: crypto.randomUUID(),
    name,
    planId,
    prefix: key.slice(0, 20),
    hash,
    scopes,
    active: true,
    createdAt: new Date().toISOString()
  };

  const keys = readKeys();
  keys.push(record);
  writeKeys(keys);

  return { ...record, key };
}

export function authenticateApiKey(key) {
  if (!key || !key.startsWith("4ndev_sk_")) return null;

  const bootstrapKey = process.env.CORE_API_KEY;

  if (bootstrapKey && key === bootstrapKey) {
    return {
      id: "core-bootstrap-key",
      name: "4N DEV Core",
      planId: process.env.CORE_API_KEY_PLAN || "pro",
      prefix: key.slice(0, 20),
      scopes: ["chat", "coding", "image", "embeddings"],
      active: true,
      createdAt: "bootstrap"
    };
  }

  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const record = readKeys().find(
    (item) => item.hash === hash && item.active
  );

  return record || null;
}

export function listApiKeys(apiKeyId = null) {
  const keys = readKeys().filter((item) => item.id !== "core-bootstrap-key");
  return apiKeyId ? keys.filter((item) => item.id === apiKeyId) : keys;
}

export function setApiKeyActive(apiKeyId, active) {
  if (!apiKeyId || typeof active !== "boolean") return null;

  const keys = readKeys();
  const index = keys.findIndex((item) => item.id === apiKeyId);
  if (index === -1) return null;

  keys[index] = {
    ...keys[index],
    active,
    updatedAt: new Date().toISOString()
  };

  writeKeys(keys);
  return keys[index];
}

export function updateApiKeyPlan(apiKeyId, planId) {
  if (!apiKeyId || !planId) return null;

  const keys = readKeys();
  const index = keys.findIndex(
    (item) => item.id === apiKeyId && item.active
  );

  if (index === -1) return null;

  keys[index] = {
    ...keys[index],
    planId,
    updatedAt: new Date().toISOString()
  };

  writeKeys(keys);
  return keys[index];
}
