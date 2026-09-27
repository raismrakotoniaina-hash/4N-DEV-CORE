import express from "express";
import { getPlan, getPlans } from "../plans.js";

const router = express.Router();

router.get("/plans", (_req, res) => {
  res.json({
    success: true,
    plans: getPlans()
  });
});

router.get("/plans/:planId", (req, res) => {
  const plan = getPlan(req.params.planId);

  if (!plan) {
    return res.status(404).json({
      success: false,
      error: "Plan not found"
    });
  }

  res.json({
    success: true,
    plan
  });
});

export default router;
