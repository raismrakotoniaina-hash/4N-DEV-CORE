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
  status: "planned",
  isConfigured() {
    return Boolean(process.env.PAPI_API_URL && process.env.PAPI_API_KEY);
  },
  async createCheckout() {
    return notConfigured();
  },
  async verifyWebhook() {
    return notConfigured();
  }
};
