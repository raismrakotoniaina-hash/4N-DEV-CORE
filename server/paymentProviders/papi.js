import crypto from "crypto";
import { getPayment } from "../billing.js";

const PAPI_API_URL = process.env.PAPI_API_URL || "https://app.papi.mg/engine/api/payment-links";
const SIGNATURE_TOLERANCE_SECONDS = 300;

function notConfigured() {
  return {
    success: false,
    error: "PAPI provider is not configured yet"
  };
}

function verifySignature(rawBody, header, secret) {
  if (!Buffer.isBuffer(rawBody) || !header || !secret) return false;

  const parts = {};
  for (const item of header.split(",")) {
    const [key, ...rest] = item.trim().split("=");
    parts[key] = rest.join("=");
  }

  const { t, v1 } = parts;
  if (!/^\d+$/.test(t || "") || !/^[0-9a-f]{64}$/.test(v1 || "")) {
    return false;
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.`)
    .update(rawBody)
    .digest();

  const received = Buffer.from(v1, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

export default {
  id: "papi",
  name: "PAPI",
  type: "local",
  currencies: ["MGA"],
  status: "available",

  isConfigured() {
    return Boolean(process.env.PAPI_API_KEY && process.env.PAPI_WEBHOOK_SECRET);
  },

  async createCheckout({ order, payment }) {
    if (!this.isConfigured()) return notConfigured();

    const baseUrl = process.env.PUBLIC_API_URL;
    const successUrl = process.env.PAPI_SUCCESS_URL || (baseUrl ? `${baseUrl}/payment/success` : null);
    const failureUrl = process.env.PAPI_FAILURE_URL || (baseUrl ? `${baseUrl}/payment/failure` : null);
    const notificationUrl = process.env.PAPI_NOTIFICATION_URL || (baseUrl ? `${baseUrl}/v1/billing/webhooks/papi` : null);

    if (!successUrl || !failureUrl || !notificationUrl) {
      return {
        success: false,
        error: "PAPI public URLs are not configured"
      };
    }

    const response = await fetch(PAPI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Token: process.env.PAPI_API_KEY
      },
      body: JSON.stringify({
        amount: order.amount,
        currency: order.currency,
        clientName: "4N DEV Customer",
        reference: payment.id,
        description: `4N DEV ${order.planId} plan`,
        successUrl,
        failureUrl,
        notificationUrl,
        validDuration: Number(process.env.PAPI_VALID_DURATION_HOURS || 24),
        testReason: process.env.PAPI_TEST_MODE === "true" ? "4N DEV Core integration test" : undefined,
        isTestMode: process.env.PAPI_TEST_MODE === "true",
        paymentTester: process.env.PAPI_TEST_MODE === "true" ? "MERCHANT_DEV" : undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || data?.message || "PAPI payment link creation failed"
      };
    }

    const result = data?.data || data;

    return {
      success: true,
      checkout: {
        paymentLink: result.paymentLink || null,
        shortLink: result.shortLink || null,
        providerReference: result.paymentReference || payment.id,
        notificationToken: result.notificationToken || null
      }
    };
  },

  async verifyWebhook(req) {
    const secret = process.env.PAPI_WEBHOOK_SECRET;
    if (!secret) return notConfigured();

    if (!verifySignature(req.rawBody, req.get("X-Papi-Signature"), secret)) {
      return {
        success: false,
        error: "Invalid PAPI notification signature"
      };
    }

    const body = req.body || {};
    if (body.paymentStatus !== "SUCCESS") {
      return {
        success: false,
        error: "PAPI payment is not successful"
      };
    }

    const paymentId = body.merchantPaymentReference;
    if (typeof paymentId !== "string") {
      return {
        success: false,
        error: "Missing PAPI merchant payment reference"
      };
    }

    const payment = getPayment(paymentId);
    if (!payment || payment.provider !== "papi") {
      return {
        success: false,
        error: "Unknown PAPI merchant payment reference"
      };
    }

    if (
      typeof body.notificationToken !== "string" ||
      body.notificationToken !== payment.notificationToken
    ) {
      return {
        success: false,
        error: "Invalid PAPI notification token"
      };
    }

    return {
      success: true,
      status: "paid",
      paymentId,
      providerReference: body.paymentReference || null
    };
  }
};
