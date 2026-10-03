import crypto from "crypto";
import { query } from "./db.js";
import { addCredits } from "./credits.js";
import { updateApiKeyPlan } from "./apiKeys.js";
import { getPlan } from "./plans.js";

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    planId: row.plan_id,
    currency: row.currency,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    providerReference: row.provider_reference,
    notificationToken: row.notification_token,
    checkoutUrl: row.checkout_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createOrder(apiKeyId, planId, currency, amount) {
  const now = new Date();
  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO billing_orders
      (id, api_key_id, plan_id, currency, amount, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $6)
     RETURNING *`,
    [id, apiKeyId, planId, currency, amount, now]
  );
  return mapOrder(result.rows[0]);
}

export async function getOrder(apiKeyId, orderId) {
  const result = await query(
    `SELECT * FROM billing_orders
     WHERE id = $1 AND api_key_id = $2
     LIMIT 1`,
    [orderId, apiKeyId]
  );
  return mapOrder(result.rows[0]);
}

export async function listOrders(apiKeyId) {
  const result = await query(
    `SELECT * FROM billing_orders
     WHERE api_key_id = $1
     ORDER BY created_at DESC`,
    [apiKeyId]
  );
  return result.rows.map(mapOrder);
}

export async function createPayment(orderId, provider, providerReference = null) {
  const now = new Date();
  const id = crypto.randomUUID();
  const result = await query(
    `INSERT INTO billing_payments
      (id, order_id, provider, provider_reference, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $5)
     RETURNING *`,
    [id, orderId, provider, providerReference, now]
  );
  return mapPayment(result.rows[0]);
}

export async function getPayment(paymentId) {
  const result = await query(
    `SELECT * FROM billing_payments
     WHERE id = $1
     LIMIT 1`,
    [paymentId]
  );
  return mapPayment(result.rows[0]);
}

export async function updatePayment(paymentId, fields) {
  const allowed = {
    providerReference: "provider_reference",
    notificationToken: "notification_token",
    checkoutUrl: "checkout_url",
    status: "status"
  };

  const updates = [];
  const values = [];
  let index = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      updates.push(`${column} = $${index++}`);
      values.push(fields[key]);
    }
  }

  if (!updates.length) return getPayment(paymentId);

  values.push(new Date(), paymentId);

  const result = await query(
    `UPDATE billing_payments
     SET ${updates.join(", ")}, updated_at = $${index++}
     WHERE id = $${index}
     RETURNING *`,
    values
  );

  return mapPayment(result.rows[0]);
}

export async function updateOrder(orderId, fields) {
  const allowed = {
    planId: "plan_id",
    currency: "currency",
    amount: "amount",
    status: "status"
  };

  const updates = [];
  const values = [];
  let index = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      updates.push(`${column} = $${index++}`);
      values.push(fields[key]);
    }
  }

  if (!updates.length) return null;

  values.push(new Date(), orderId);

  const result = await query(
    `UPDATE billing_orders
     SET ${updates.join(", ")}, updated_at = $${index++}
     WHERE id = $${index}
     RETURNING *`,
    values
  );

  return mapOrder(result.rows[0]);
}

export function listProviders() {
  return [
    {
      id: "papi",
      name: "PAPI",
      type: "local",
      currency: ["MGA"],
      status: "available"
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

export async function fulfillPaidPayment(paymentId, providerReference = null) {
  const paymentResult = await query(
    `SELECT * FROM billing_payments
     WHERE id = $1
     LIMIT 1`,
    [paymentId]
  );
  const payment = mapPayment(paymentResult.rows[0]);
  if (!payment) return { success: false, error: "Payment not found" };

  const order = await getOrderById(payment.orderId);
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

  const now = new Date();
  const updatedPaymentResult = await query(
    `UPDATE billing_payments
     SET status = 'paid',
         provider_reference = COALESCE($1, provider_reference),
         updated_at = $2
     WHERE id = $3 AND status <> 'paid'
     RETURNING *`,
    [providerReference, now, paymentId]
  );

  if (!updatedPaymentResult.rows[0]) {
    const latestPayment = await getPayment(paymentId);
    const latestOrder = await getOrderById(payment.orderId);
    return {
      success: true,
      alreadyFulfilled: true,
      payment: latestPayment,
      order: latestOrder
    };
  }

  const updatedOrder = await updateOrder(order.id, { status: "paid" });
  const balance = await addCredits(
    order.apiKeyId,
    plan.credits,
    `payment_${payment.provider}`
  );
  const updatedKey = await updateApiKeyPlan(order.apiKeyId, plan.id);

  return {
    success: true,
    alreadyFulfilled: false,
    payment: mapPayment(updatedPaymentResult.rows[0]),
    order: updatedOrder,
    plan: plan.id,
    planUpdated: Boolean(updatedKey) || order.apiKeyId === "core-bootstrap-key",
    creditsAdded: plan.credits,
    balance
  };
}

async function getOrderById(orderId) {
  const result = await query(
    `SELECT * FROM billing_orders
     WHERE id = $1
     LIMIT 1`,
    [orderId]
  );
  return mapOrder(result.rows[0]);
}
