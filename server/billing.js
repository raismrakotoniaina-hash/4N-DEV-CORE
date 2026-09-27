import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "billing.json");

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({
      orders: [],
      payments: []
    }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
}

export function createOrder(apiKeyId, planId, currency, amount) {
  const store = readStore();
  const now = new Date().toISOString();

  const order = {
    id: crypto.randomUUID(),
    apiKeyId,
    planId,
    currency,
    amount,
    status: "pending",
    createdAt: now,
    updatedAt: now
  };

  store.orders.push(order);
  writeStore(store);
  return order;
}

export function getOrder(apiKeyId, orderId) {
  return readStore().orders.find(
    order => order.id === orderId && order.apiKeyId === apiKeyId
  ) || null;
}

export function listOrders(apiKeyId) {
  return readStore().orders.filter(order => order.apiKeyId === apiKeyId);
}

export function createPayment(orderId, provider, providerReference = null) {
  const store = readStore();
  const now = new Date().toISOString();

  const payment = {
    id: crypto.randomUUID(),
    orderId,
    provider,
    providerReference,
    status: "pending",
    createdAt: now,
    updatedAt: now
  };

  store.payments.push(payment);
  writeStore(store);
  return payment;
}

export function getPayment(paymentId) {
  return readStore().payments.find(payment => payment.id === paymentId) || null;
}

export function updatePayment(paymentId, fields) {
  const store = readStore();
  const index = store.payments.findIndex(payment => payment.id === paymentId);

  if (index === -1) return null;

  store.payments[index] = {
    ...store.payments[index],
    ...fields,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return store.payments[index];
}

export function updateOrder(orderId, fields) {
  const store = readStore();
  const index = store.orders.findIndex(order => order.id === orderId);

  if (index === -1) return null;

  store.orders[index] = {
    ...store.orders[index],
    ...fields,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return store.orders[index];
}

export function listProviders() {
  return [
    {
      id: "papi",
      name: "PAPI",
      type: "local",
      currency: ["MGA"],
      status: "planned"
    },
    {
      id: "international",
      name: "International Gateway",
      type: "international",
      currency: ["USD", "EUR", "GBP"],
      status: "planned"
    }
  ];
}
