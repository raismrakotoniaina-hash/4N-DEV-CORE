import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getPlan } from "../plans.js";
import {
  createOrder,
  getOrder,
  listOrders,
  createPayment,
  getPayment,
  updatePayment,
  updateOrder,
  listProviders,
  fulfillPaidPayment
} from "../billing.js";

const router = express.Router();

router.post("/webhooks/:provider", (req, res) => {
  const secret = process.env.CORE_PAYMENT_WEBHOOK_SECRET;
  const supplied = req.get("x-4ndev-webhook-secret");

  if (!secret || secret === "change-this-before-use") {
    return res.status(503).json({
      success: false,
      error: "CORE_PAYMENT_WEBHOOK_SECRET is not configured"
    });
  }

  if (!supplied || supplied !== secret) {
    return res.status(403).json({
      success: false,
      error: "Invalid webhook secret"
    });
  }

  const provider = req.params.provider.toLowerCase();
  if (!["papi", "international"].includes(provider)) {
    return res.status(400).json({
      success: false,
      error: "Unsupported payment provider"
    });
  }

  const { paymentId, providerReference, status } = req.body || {};

  if (status !== "paid" || typeof paymentId !== "string") {
    return res.status(400).json({
      success: false,
      error: "A verified paid event with paymentId is required"
    });
  }

  const result = fulfillPaidPayment(paymentId, providerReference);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json({
    success: true,
    provider,
    already_fulfilled: result.alreadyFulfilled,
    payment: result.payment,
    order: result.order,
    credits_added: result.creditsAdded || 0,
    credits_balance: result.balance ?? null
  });
});

router.use(requireApiKey());

router.get("/plans", (_req, res) => {
  res.json({
    success: true,
    currency_options: ["MGA", "USD", "EUR", "GBP"],
    plans: [
      getPlan("free"),
      getPlan("starter"),
      getPlan("pro"),
      getPlan("premium")
    ]
  });
});

router.get("/providers", (_req, res) => {
  res.json({
    success: true,
    providers: listProviders()
  });
});

router.get("/orders", (req, res) => {
  res.json({
    success: true,
    orders: listOrders(req.apiKey.id)
  });
});

router.post("/orders", (req, res) => {
  const { planId, currency = "MGA" } = req.body || {};
  const plan = getPlan(planId);

  if (!plan || plan.id === "free") {
    return res.status(400).json({
      success: false,
      error: "A paid plan is required"
    });
  }

  const allowedCurrencies = ["MGA", "USD", "EUR", "GBP"];
  if (!allowedCurrencies.includes(currency)) {
    return res.status(400).json({
      success: false,
      error: "Unsupported currency"
    });
  }

  const order = createOrder(
    req.apiKey.id,
    plan.id,
    currency,
    plan.priceMGA
  );

  res.status(201).json({
    success: true,
    order,
    message: "Order created. Payment provider integration will be handled next."
  });
});

router.post("/orders/:orderId/payments", (req, res) => {
  const order = getOrder(req.apiKey.id, req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: "Order not found"
    });
  }

  if (order.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: "Order is not payable"
    });
  }

  const provider = typeof req.body?.provider === "string"
    ? req.body.provider.trim().toLowerCase()
    : "";

  if (!["papi", "international"].includes(provider)) {
    return res.status(400).json({
      success: false,
      error: "Unsupported payment provider"
    });
  }

  const payment = createPayment(order.id, provider);
  res.status(201).json({
    success: true,
    payment,
    message: "Payment created. Awaiting verified provider webhook."
  });
});

router.get("/payments/:paymentId", (req, res) => {
  const payment = getPayment(req.params.paymentId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: "Payment not found"
    });
  }

  const order = getOrder(req.apiKey.id, payment.orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: "Payment not found"
    });
  }

  res.json({ success: true, payment, order });
});


export default router;
