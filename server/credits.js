import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
const creditsPath = path.join(dataDir, "credits.json");
const transactionsPath = path.join(dataDir, "credit-transactions.json");

function ensureStore(filePath) {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
}

function read(filePath) {
  ensureStore(filePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function write(filePath, data) {
  ensureStore(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function getBalance(apiKeyId) {
  const accounts = read(creditsPath);
  const account = accounts.find((item) => item.apiKeyId === apiKeyId);
  return account?.balance ?? 0;
}

export function addCredits(apiKeyId, amount, reason = "top_up") {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid credit amount");

  const accounts = read(creditsPath);
  let account = accounts.find((item) => item.apiKeyId === apiKeyId);

  if (!account) {
    account = { apiKeyId, balance: 0, updatedAt: new Date().toISOString() };
    accounts.push(account);
  }

  account.balance += amount;
  account.updatedAt = new Date().toISOString();
  write(creditsPath, accounts);

  const transactions = read(transactionsPath);
  transactions.push({
    id: crypto.randomUUID(),
    apiKeyId,
    type: "credit",
    amount,
    reason,
    createdAt: new Date().toISOString()
  });
  write(transactionsPath, transactions);

  return account.balance;
}

export function spendCredits(apiKeyId, amount, reason = "api_usage") {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid credit amount");

  const accounts = read(creditsPath);
  const account = accounts.find((item) => item.apiKeyId === apiKeyId);

  if (!account || account.balance < amount) return null;

  account.balance -= amount;
  account.updatedAt = new Date().toISOString();
  write(creditsPath, accounts);

  const transactions = read(transactionsPath);
  transactions.push({
    id: crypto.randomUUID(),
    apiKeyId,
    type: "debit",
    amount,
    reason,
    createdAt: new Date().toISOString()
  });
  write(transactionsPath, transactions);

  return account.balance;
}
