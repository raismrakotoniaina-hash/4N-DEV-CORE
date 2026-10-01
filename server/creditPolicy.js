const SERVICE_PRICING = {
  chat: {
    credits: 1,
    maxInputCharacters: 12000,
    maxOutputTokens: 1200
  },
  coding: {
    credits: 5,
    maxInputCharacters: 24000,
    maxOutputTokens: 3000
  },
  image: {
    low: 10,
    medium: 25,
    high: 50
  },
  embeddings: {
    credits: 1,
    maxInputCharacters: 20000
  },
  builder: {
    credits: 10,
    maxInputCharacters: 24000,
    maxFiles: 40,
    maxTotalCharacters: 4000000
  }
};

export function getServicePrice(service, option = null) {
  const pricing = SERVICE_PRICING[service];

  if (!pricing) return null;

  if (service === "image") {
    return pricing[option] ?? null;
  }

  return pricing.credits;
}

export function getServiceLimit(service) {
  return SERVICE_PRICING[service] ?? null;
}

export function getCreditPolicy() {
  return SERVICE_PRICING;
}
