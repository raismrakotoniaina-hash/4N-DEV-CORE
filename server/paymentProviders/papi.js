import { getPayment } from "../billing.js";

const PAPI_API_URL = process.env.PAPI_API_URL || "https://app.papi.mg/engine/api/payment-links";

function notConfigured() {
  return {
    success: false,
    error: "PAPI provider is not configured yet"
  };
}

export default {
  id: "papi",
  name: "PAPI",
  type: "local",
  currencies: ["MGA"],
  status: "available",

  isConfigured() {
    return Boolean(process.env.PAPI_API_KEY);
  },

  async createCheckout({ order, payment }) {
    if (!process.env.PAPI_API_KEY) return notConfigured();

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
        validDuration: 60,
        isTestMode: process.env.PAPI_TEST_MODE === "true"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || data?.message || data?.error || "PAPI payment link creation failed"
      };
    }

    const result = data?.data || {};

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
    const body = req.body || {};
    const paymentId = body.paymentReference;

    if (body.paymentStatus !== "SUCCESS") {
      return {
        success: false,
        error: "PAPI payment is not successful"
      };
    }

    if (typeof paymentId !== "string") {
      return {
        success: false,
        error: "Missing PAPI payment reference"
      };
    }

    const payment = getPayment(paymentId);

    if (!payment || payment.provider !== "papi") {
      return {
        success: false,
        error: "Unknown PAPI payment reference"
      };
    }

    if (!payment.notificationToken) {
      return {
        success: false,
        error: "PAPI notification token is missing"
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
