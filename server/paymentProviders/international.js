import { getPayment } from "../billing.js";

const DEFAULT_API_URL = "https://api.zopayo.com/operation/";

function notConfigured() {
  return {
    success: false,
    error: "Zopayo international payment provider is not configured yet"
  };
}

function getBaseUrl() {
  return String(process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");
}

function getRedirectUrl(name, fallbackPath) {
  const configured = process.env[name];
  if (configured) return configured;
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}${fallbackPath}` : null;
}

function getWebhookSecret(req) {
  return String(req?.get?.("X-Webhook-Secret") || "");
}

function isSuccessfulStatus(value) {
  return String(value || "").trim().toUpperCase() === "COMPLETED";
}

function extractPaymentId(body) {
  const value =
    body?.id_relation ??
    body?.payment_id ??
    body?.paymentId ??
    body?.merchantPaymentReference ??
    body?.reference;

  return typeof value === "string" ? value.trim() : "";
}

function extractProviderReference(body) {
  const value =
    body?.payment_reference ??
    body?.paymentReference ??
    body?.reference_zopayo ??
    body?.transaction_id ??
    body?.transactionId ??
    body?.id_transaction;

  return typeof value === "string" ? value.trim() : null;
}

export default {
  id: "international",
  name: "Zopayo",
  type: "international",
  currencies: ["USD", "EUR"],
  status: "available",

  isConfigured() {
    return Boolean(
      process.env.INTERNATIONAL_PAYMENT_API_KEY &&
      getBaseUrl() &&
      getRedirectUrl("INTERNATIONAL_SUCCESS_URL", "/payment/success") &&
      getRedirectUrl("INTERNATIONAL_FAILURE_URL", "/payment/failure")
    );
  },

  async createCheckout({ order, payment }) {
    if (!this.isConfigured()) return notConfigured();

    const apiUrl =
      process.env.INTERNATIONAL_PAYMENT_API_URL || DEFAULT_API_URL;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cle_prive: process.env.INTERNATIONAL_PAYMENT_API_KEY,
        params_montant: "false",
        montant: Number(order.amount).toFixed(2),
        devise: order.currency,
        id_relation: payment.id,
        raison: `4N DEV ${order.planId} plan`.slice(0, 100),
        url_emi: getRedirectUrl("INTERNATIONAL_SUCCESS_URL", "/payment/success"),
        url_error_emi: getRedirectUrl("INTERNATIONAL_FAILURE_URL", "/payment/failure")
      })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: "Invalid response from Zopayo"
      };
    }

    if (!response.ok || data?.success === false) {
      return {
        success: false,
        error: data?.message || "Zopayo payment link creation failed"
      };
    }

    const paymentLink = data?.payment_url || data?.data?.payment_url;
    if (!paymentLink) {
      return {
        success: false,
        error: "Zopayo did not return a payment URL"
      };
    }

    return {
      success: true,
      checkout: {
        paymentLink,
        shortLink: null,
        providerReference: extractProviderReference(data) || payment.id,
        notificationToken: null
      }
    };
  },

  async verifyWebhook(req) {
    const webhookSecret = process.env.INTERNATIONAL_PAYMENT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return {
        success: false,
        error: "International webhook secret is not configured"
      };
    }

    const signature = getWebhookSecret(req);
    if (!signature || signature !== webhookSecret) {
      return {
        success: false,
        error: "Invalid Zopayo webhook security header"
      };
    }

    const body = req.body || {};
    const status = body?.statut_general;

    if (!isSuccessfulStatus(status)) {
      return {
        success: false,
        error: `Zopayo payment status is not COMPLETED: ${String(status || "UNKNOWN")}`
      };
    }

    const paymentId = extractPaymentId(body);
    if (!paymentId) {
      return {
        success: false,
        error: "Missing Zopayo id_relation"
      };
    }

    const payment = await getPayment(paymentId);
    if (!payment || payment.provider !== "international") {
      return {
        success: false,
        error: "Unknown Zopayo payment reference"
      };
    }

    return {
      success: true,
      status: "paid",
      paymentId,
      providerReference: body?.id_transaction || extractProviderReference(body)
    };
  }
};
