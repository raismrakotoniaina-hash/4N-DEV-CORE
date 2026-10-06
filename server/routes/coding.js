import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { requirePlanFeature } from "../middleware/planFeature.js";
import { generateCodingResponse } from "../aiGateway.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits } from "../credits.js";
import { getServicePrice, getServiceLimit } from "../creditPolicy.js";

const router = express.Router();
const CODING_COST = getServicePrice("coding");
const CODING_LIMITS = getServiceLimit("coding");

router.post("/coding", requireApiKey("coding"), requirePlanFeature("coding"), async (req, res) => {
  try {
    const { input } = req.body || {};

    if (typeof input !== "string" && !Array.isArray(input)) {
      return res.status(400).json({
        success: false,
        error: "input must be a string or an array"
      });
    }

    const inputLength = typeof input === "string"
      ? input.length
      : JSON.stringify(input).length;

    if (inputLength > CODING_LIMITS.maxInputCharacters) {
      return res.status(413).json({
        success: false,
        error: "Coding input is too large",
        max_characters: CODING_LIMITS.maxInputCharacters
      });
    }

    const balanceBefore = await getBalance(req.apiKey.id);

    if (balanceBefore < CODING_COST) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: CODING_COST
      });
    }

    const result = await generateCodingResponse(input);
    const balanceAfter = await spendCredits(req.apiKey.id, CODING_COST, "coding_usage");

    if (balanceAfter === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: CODING_COST
      });
    }

    await recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/coding",
      usage: {
        ...result.usage,
        credits_used: CODING_COST,
        credits_remaining: balanceAfter
      }
    });

    res.json({
      success: true,
      id: result.id,
      model: result.model,
      output: result.text,
      usage: result.usage,
      credits_used: CODING_COST,
      credits_remaining: balanceAfter
    });
  } catch (error) {
    console.error("4N DEV Coding Gateway error:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Coding AI error"
    });
  }
});

export default router;
