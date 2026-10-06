import crypto from "node:crypto";
import { query } from "./db.js";
import { readStore, updateStore } from "./localStore.js";

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function validateAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Invalid credit amount");
  }
}

export async function getBalance(apiKeyId) {
  if (!isDatabaseConfigured()) {
    if (apiKeyId === "core-bootstrap-key") {
      const initialCredits = Number(process.env.CORE_API_KEY_INITIAL_CREDITS || 500);
      return Number.isInteger(initialCredits) && initialCredits > 0 ? initialCredits : 500;
    }

    const state = await readStore();
    return Number(state.creditAccounts[apiKeyId]?.balance || 0);
  }

  const existing = await query(
    "SELECT balance FROM credit_accounts WHERE api_key_id = $1",
    [apiKeyId]
  );

  if (existing.rows[0]) return Number(existing.rows[0].balance);

  if (apiKeyId === "core-bootstrap-key") {
    const initialCredits = Number(process.env.CORE_API_KEY_INITIAL_CREDITS || 500);
    const balance = Number.isInteger(initialCredits) && initialCredits > 0 ? initialCredits : 500;
    const now = new Date();

    await query(
      "INSERT INTO credit_accounts (api_key_id, balance, updated_at) VALUES ($1, $2, $3) ON CONFLICT (api_key_id) DO NOTHING",
      [apiKeyId, balance, now]
    );

    const inserted = await query(
      "SELECT balance FROM credit_accounts WHERE api_key_id = $1",
      [apiKeyId]
    );

    if (inserted.rows[0] && Number(inserted.rows[0].balance) === balance) {
      await query(
        "INSERT INTO credit_transactions (id, api_key_id, type, amount, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [crypto.randomUUID(), apiKeyId, "credit", balance, "bootstrap_pro_plan", now]
      );
    }

    return Number(inserted.rows[0]?.balance ?? 0);
  }

  return 0;
}

export async function addCredits(apiKeyId, amount, reason = "top_up") {
  validateAmount(amount);

  if (!isDatabaseConfigured()) {
    let balance = 0;
    await updateStore((state) => {
      const current = Number(state.creditAccounts[apiKeyId]?.balance || 0);
      balance = current + amount;
      return {
        ...state,
        creditAccounts: {
          ...state.creditAccounts,
          [apiKeyId]: {
            apiKeyId,
            balance,
            updatedAt: new Date().toISOString()
          }
        },
        creditTransactions: [
          ...state.creditTransactions,
          {
            id: crypto.randomUUID(),
            apiKeyId,
            type: "credit",
            amount,
            reason,
            createdAt: new Date().toISOString()
          }
        ]
      };
    });
    return balance;
  }

  const now = new Date();
  const client = await (await import("./db.js")).getDb().connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "INSERT INTO credit_accounts (api_key_id, balance, updated_at) VALUES ($1, $2, $3) ON CONFLICT (api_key_id) DO UPDATE SET balance = credit_accounts.balance + EXCLUDED.balance, updated_at = EXCLUDED.updated_at RETURNING balance",
      [apiKeyId, amount, now]
    );

    await client.query(
      "INSERT INTO credit_transactions (id, api_key_id, type, amount, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [crypto.randomUUID(), apiKeyId, "credit", amount, reason, now]
    );

    await client.query("COMMIT");
    return Number(result.rows[0].balance);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function spendCredits(apiKeyId, amount, reason = "api_usage") {
  validateAmount(amount);

  if (!isDatabaseConfigured()) {
    let balance = null;
    await updateStore((state) => {
      const current = Number(state.creditAccounts[apiKeyId]?.balance || 0);
      if (current < amount) return state;

      balance = current - amount;
      return {
        ...state,
        creditAccounts: {
          ...state.creditAccounts,
          [apiKeyId]: {
            ...state.creditAccounts[apiKeyId],
            apiKeyId,
            balance,
            updatedAt: new Date().toISOString()
          }
        },
        creditTransactions: [
          ...state.creditTransactions,
          {
            id: crypto.randomUUID(),
            apiKeyId,
            type: "debit",
            amount,
            reason,
            createdAt: new Date().toISOString()
          }
        ]
      };
    });
    return balance;
  }

  const now = new Date();
  const client = await (await import("./db.js")).getDb().connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "UPDATE credit_accounts SET balance = balance - $1, updated_at = $2 WHERE api_key_id = $3 AND balance >= $1 RETURNING balance",
      [amount, now, apiKeyId]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "INSERT INTO credit_transactions (id, api_key_id, type, amount, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [crypto.randomUUID(), apiKeyId, "debit", amount, reason, now]
    );

    await client.query("COMMIT");
    return Number(result.rows[0].balance);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refundCredits(apiKeyId, amount, reason = "operation_refund") {
  validateAmount(amount);

  if (!isDatabaseConfigured()) {
    let balance = null;
    await updateStore((state) => {
      const account = state.creditAccounts[apiKeyId];
      if (!account) return state;

      balance = Number(account.balance || 0) + amount;
      return {
        ...state,
        creditAccounts: {
          ...state.creditAccounts,
          [apiKeyId]: {
            ...account,
            balance,
            updatedAt: new Date().toISOString()
          }
        },
        creditTransactions: [
          ...state.creditTransactions,
          {
            id: crypto.randomUUID(),
            apiKeyId,
            type: "refund",
            amount,
            reason,
            createdAt: new Date().toISOString()
          }
        ]
      };
    });

    if (balance === null) {
      throw new Error("Credit account not found for refund");
    }

    return balance;
  }

  const now = new Date();
  const client = await (await import("./db.js")).getDb().connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "UPDATE credit_accounts SET balance = balance + $1, updated_at = $2 WHERE api_key_id = $3 RETURNING balance",
      [amount, now, apiKeyId]
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("Credit account not found for refund");
    }

    await client.query(
      "INSERT INTO credit_transactions (id, api_key_id, type, amount, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [crypto.randomUUID(), apiKeyId, "refund", amount, reason, now]
    );

    await client.query("COMMIT");
    return Number(result.rows[0].balance);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function calculateChatCredits(usage = {}) {
  const input = Number(usage.input_tokens || 0);
  const output = Number(usage.output_tokens || 0);

  const units = input + output * 3;
  return Math.max(1, Math.ceil(units / 1000));
}
