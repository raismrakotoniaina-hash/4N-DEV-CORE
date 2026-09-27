import { getPlan } from "../plans.js";

export function requirePlanFeature(feature) {
  return (req, res, next) => {
    const planId = req.apiKey?.planId || "free";
    const plan = getPlan(planId);

    if (!plan) {
      return res.status(403).json({
        success: false,
        error: "Developer plan is invalid"
      });
    }

    if (!plan.features.includes(feature)) {
      return res.status(403).json({
        success: false,
        error: "Feature unavailable on current plan",
        plan: plan.id,
        required_feature: feature
      });
    }

    req.plan = plan;
    next();
  };
}
