import papiProvider from "./papi.js";
import internationalProvider from "./international.js";

const PROVIDERS = {
  papi: papiProvider,
  international: internationalProvider
};

export function getPaymentProvider(providerId) {
  return PROVIDERS[String(providerId || "").trim().toLowerCase()] || null;
}

export function listPaymentProviders() {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    currencies: provider.currencies,
    status: provider.status,
    configured: provider.isConfigured()
  }));
}
