import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { requirePlanFeature } from "../middleware/planFeature.js";
import { generateImage } from "../aiGateway.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits } from "../credits.js";
import { getServicePrice } from "../creditPolicy.js";

const router = express.Router();
const ALLOWED_QUALITY = ["low", "medium", "high"];

router.post("/image", requireApiKey("image"), requirePlanFeature("image"), async (req, res) => {
  try {
    const { prompt, quality = "medium" } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "prompt must be a non-empty string" });
    }

    if (!ALLOWED_QUALITY.includes(quality)) {
      return res.status(400).json({ success: false, error: "quality must be low, medium, or high" });
    }

    const cost = getServicePrice("image", quality);
    const balanceBefore = getBalance(req.apiKey.id);

    if (balanceBefore < cost) {
      return res.status(402).json({ success: false, error: "Insufficient 4N DEV credits", credits: balanceBefore, credits_required: cost });
    }

    const result = await generateImage(prompt, quality);
    const balanceAfter = spendCredits(req.apiKey.id, cost, "image_usage");

    if (balanceAfter === null) {
      return res.status(402).json({ success: false, error: "Insufficient 4N DEV credits", credits: balanceBefore, credits_required: cost });
    }

    recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/image",
      usage: { credits_used: cost, credits_remaining: balanceAfter, quality }
    });

    res.json({ success: true, model: result.model, image: result.image, credits_used: cost, credits_remaining: balanceAfter });
  } catch (error) {
    console.error("4N DEV Image Gateway error:", error.message);
    res.status(error.statusCode || 500).json({ success: false, error: error.message || "Image generation error" });
  }
});

export default router;
