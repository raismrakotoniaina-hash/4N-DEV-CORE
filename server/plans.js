const PLANS = [
  {
    id: "free",
    name: "Free",
    priceMGA: 0,
    credits: 10,
    monthly: true,
    features: ["chat"]
  },
  {
    id: "starter",
    name: "Starter",
    priceMGA: 45000,
    credits: 100,
    monthly: true,
    features: ["chat", "coding", "image"]
  },
  {
    id: "pro",
    name: "Pro",
    priceMGA: 145000,
    credits: 500,
    monthly: true,
    features: ["chat", "coding", "image", "embeddings"]
  },
  {
    id: "premium",
    name: "Premium",
    priceMGA: 490000,
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
