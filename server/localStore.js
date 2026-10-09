import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = process.env.CORE_DATA_DIR || path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "core-storage.json");

const DEFAULT_STATE = {
  apiKeys: [],
  creditAccounts: {},
  creditTransactions: [],
  projects: [],
  projectFiles: [],
  usageRecords: [],
  builds: [],
  deployments: [],
  customDomains: [],
  billingOrders: [],
  billingPayments: []
};

let statePromise = null;
let writeQueue = Promise.resolve();

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

async function loadState() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaultState(),
      ...parsed,
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
      creditAccounts: parsed.creditAccounts && typeof parsed.creditAccounts === "object" ? parsed.creditAccounts : {},
      creditTransactions: Array.isArray(parsed.creditTransactions) ? parsed.creditTransactions : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      projectFiles: Array.isArray(parsed.projectFiles) ? parsed.projectFiles : [],
      usageRecords: Array.isArray(parsed.usageRecords) ? parsed.usageRecords : [],
      builds: Array.isArray(parsed.builds) ? parsed.builds : [],
      deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [],
      customDomains: Array.isArray(parsed.customDomains) ? parsed.customDomains : [],
      billingOrders: Array.isArray(parsed.billingOrders) ? parsed.billingOrders : [],
      billingPayments: Array.isArray(parsed.billingPayments) ? parsed.billingPayments : []
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return cloneDefaultState();
  }
}

async function getState() {
  if (!statePromise) statePromise = loadState();
  return statePromise;
}

async function persist(nextState) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(nextState, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

export async function readStore() {
  return getState();
}

export async function updateStore(mutator) {
  const operation = writeQueue.then(async () => {
    const current = await getState();
    const next = await mutator(current);
    await persist(next);
    statePromise = Promise.resolve(next);
    return next;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

export function getStorePath() {
  return DATA_FILE;
}
