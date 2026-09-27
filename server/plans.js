const PLANS = [
  {
    id: "free",
    name: "Free",
    prices: { MGA: 0, USD: 0, EUR: 0, GBP: 0 },
    credits: 10,
    monthly: true,
    features: ["chat"]
  },
  {
    id: "starter",
    name: "Starter",
    prices: { MGA: 45000, USD: 15, EUR: 14, GBP: 12 },
    credits: 100,
    monthly: true,
    features: ["chat", "coding", "image"]
  },
  {
    id: "pro",
    name: "Pro",
    prices: { MGA: 145000, USD: 45, EUR: 42, GBP: 36 },
    credits: 500,
    monthly: true,
    features: ["chat", "coding", "image", "embeddings"]
  },
  {
    id: "premium",
    name: "Premium",
    prices: { MGA: 490000, USD: 149, EUR: 139, GBP: 119 },
    credits: 2000,
    monthly: true,
    features: ["chat", "coding", "image", "embeddings", "priority"]
  }
];

export function getPlans() {
  return PLANS;
}

export function getPlan(planId) {
  return PLANS.find((plan) => plan.id === planId) || null;
}

export function getPlanPrice(planId, currency = "MGA") {
  const plan = getPlan(planId);
  if (!plan) return null;
  return plan.prices?.[currency] ?? null;
}
