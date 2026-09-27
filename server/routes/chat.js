import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { generateChatResponse } from "../aiGateway.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits, calculateChatCredits } from "../credits.js";

const router = express.Router();

router.post("/chat", requireApiKey("chat"), async (req, res) => {
  try {
    const { input } = req.body || {};

    if (typeof input !== "string" && !Array.isArray(input)) {
      return res.status(400).json({
        success: false,
        error: "input must be a string or an array"
      });
    }

    const balanceBefore = getBalance(req.apiKey.id);

    if (balanceBefore < 1) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore
      });
    }

    const result = await generateChatResponse(input);
    const creditsUsed = calculateChatCredits(result.usage);

    const balanceAfter = spendCredits(
      req.apiKey.id,
      creditsUsed,
      "chat_usage"
    );

    if (balanceAfter === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits for this request",
        credits_required: creditsUsed,
        credits: balanceBefore
      });
    }

    recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/chat",
      usage: {
        ...result.usage,
        credits_used: creditsUsed,
        credits_remaining: balanceAfter
      }
    });

    res.json({
      success: true,
      id: result.id,
      model: result.model,
      output: result.text,
      usage: result.usage,
      credits_used: creditsUsed,
      credits_remaining: balanceAfter
    });
  } catch (error) {
    console.error("4N DEV AI Gateway error:", error.message);

    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "AI Gateway error"
    });
  }
});

export default router;
