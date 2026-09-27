import fs from "fs";
import path from "path";
import { addCredits } from "./credits.js";
import { getPlan } from "./plans.js";

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


export function fulfillPaidPayment(paymentId, providerReference = null) {
  const store = readStore();
  const payment = store.payments.find(item => item.id === paymentId);
  if (!payment) return { success: false, error: "Payment not found" };

  const order = store.orders.find(item => item.id === payment.orderId);
  if (!order) return { success: false, error: "Order not found" };

  if (payment.status === "paid" || order.status === "paid") {
    return {
      success: true,
      alreadyFulfilled: true,
      payment,
      order
    };
  }

  const plan = getPlan(order.planId);
  if (!plan || !Number.isInteger(plan.credits) || plan.credits <= 0) {
    return { success: false, error: "Invalid plan credits" };
  }

  payment.status = "paid";
  payment.providerReference = providerReference || payment.providerReference;
  payment.updatedAt = new Date().toISOString();

  order.status = "paid";
  order.updatedAt = new Date().toISOString();

  writeStore(store);

  const balance = addCredits(order.apiKeyId, plan.credits, `payment_${payment.provider}`);

  return {
    success: true,
    alreadyFulfilled: false,
    payment,
    order,
    creditsAdded: plan.credits,
    balance
  };
}
