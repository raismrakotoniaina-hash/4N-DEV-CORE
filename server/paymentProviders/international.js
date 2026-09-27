function notConfigured() {
  return {
    success: false,
    error: "International payment provider is not configured yet"
  };
}

export default {
  id: "international",
  name: "International Gateway",
  type: "international",
  currencies: ["USD", "EUR", "GBP"],
  status: "planned",
  isConfigured() {
    return Boolean(
      process.env.INTERNATIONAL_PAYMENT_API_URL &&
      process.env.INTERNATIONAL_PAYMENT_API_KEY
    );
  },
  async createCheckout() {
    return notConfigured();
  },
  async verifyWebhook() {
    return notConfigured();
  }
};
