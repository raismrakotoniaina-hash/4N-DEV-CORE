import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getPlan, getPlanPrice } from "../plans.js";
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

router.post("/webhooks/:provider", async (req, res) => {
  const provider = req.params.provider.toLowerCase();
  const adapter = getPaymentProvider(provider);

  if (!adapter) {
    return res.status(400).json({
      success: false,
      error: "Unsupported payment provider"
    });
  }

  if (!adapter.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: `${adapter.name} provider is not configured`
    });
  }

  try {
    const verification = await adapter.verifyWebhook(req);

    if (!verification.success) {
      return res.status(403).json(verification);
    }

    const result = fulfillPaidPayment(
      verification.paymentId,
      verification.providerReference
    );

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
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || "Payment provider webhook verification failed"
    });
  }
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
    providers: listPaymentProviders()
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

  const amount = getPlanPrice(plan.id, currency);
  if (amount === null) {
    return res.status(400).json({
      success: false,
      error: "Currency is not configured for this plan"
    });
  }

  const order = createOrder(
    req.apiKey.id,
    plan.id,
    currency,
    amount
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

  const adapter = getPaymentProvider(provider);

  if (!adapter) {
    return res.status(400).json({
      success: false,
      error: "Unsupported payment provider"
    });
  }

  const payment = createPayment(order.id, provider);

  res.status(201).json({
    success: true,
    payment,
    provider: {
      id: adapter.id,
      name: adapter.name,
      configured: adapter.isConfigured()
    },
    message: adapter.isConfigured()
      ? "Payment created. Use the checkout endpoint to start provider payment."
      : "Payment created, but this provider is not configured yet."
  });
});


router.post("/orders/:orderId/checkout", async (req, res) => {
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

  const adapter = getPaymentProvider(provider);

  if (!adapter) {
    return res.status(400).json({
      success: false,
      error: "Unsupported payment provider"
    });
  }

  if (!adapter.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: `${adapter.name} provider is not configured yet`,
      provider: adapter.id
    });
  }

  const payment = createPayment(order.id, provider);
  const checkoutResult = await adapter.createCheckout({ order, payment });

  if (!checkoutResult.success) {
    return res.status(502).json(checkoutResult);
  }

  const checkout = checkoutResult.checkout || null;

  if (checkout) {
    updatePayment(payment.id, {
      providerReference: checkout.providerReference || payment.providerReference,
      notificationToken: checkout.notificationToken || null,
      checkoutUrl: checkout.paymentLink || checkout.shortLink || null
    });
  }

  res.status(201).json({
    success: true,
    provider: adapter.id,
    payment: getPayment(payment.id),
    checkout
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
