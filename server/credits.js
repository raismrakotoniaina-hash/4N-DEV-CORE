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
  let account = accounts.find((item) => item.apiKeyId === apiKeyId);

  if (!account && apiKeyId === "core-bootstrap-key") {
    const initialCredits = Number(process.env.CORE_API_KEY_INITIAL_CREDITS || 500);

    account = {
      apiKeyId,
      balance: Number.isInteger(initialCredits) && initialCredits > 0 ? initialCredits : 500,
      updatedAt: new Date().toISOString()
    };

    accounts.push(account);
    write(creditsPath, accounts);

    const transactions = read(transactionsPath);
    transactions.push({
      id: crypto.randomUUID(),
      apiKeyId,
      type: "credit",
      amount: account.balance,
      reason: "bootstrap_pro_plan",
      createdAt: new Date().toISOString()
    });
    write(transactionsPath, transactions);
  }

  return account?.balance ?? 0;
}

export function addCredits(apiKeyId, amount, reason = "top_up") {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Invalid credit amount");
  }

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
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Invalid credit amount");
  }

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

export function calculateChatCredits(usage = {}) {
  const input = Number(usage.input_tokens || 0);
  const output = Number(usage.output_tokens || 0);

  // 1 credit = 1,000 weighted token units.
  // Output is weighted 3x to protect 4N DEV margin.
  const units = input + output * 3;
  return Math.max(1, Math.ceil(units / 1000));
}
