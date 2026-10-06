import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { requirePlanFeature } from "../middleware/planFeature.js";
import { generateEmbedding } from "../aiGateway.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits } from "../credits.js";
import { getServicePrice, getServiceLimit } from "../creditPolicy.js";

const router = express.Router();
const EMBEDDING_COST = getServicePrice("embeddings");
const EMBEDDING_LIMITS = getServiceLimit("embeddings");

router.post("/embeddings", requireApiKey("embeddings"), requirePlanFeature("embeddings"), async (req, res) => {
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

    if (inputLength > EMBEDDING_LIMITS.maxInputCharacters) {
      return res.status(413).json({
        success: false,
        error: "Embedding input is too large",
        max_characters: EMBEDDING_LIMITS.maxInputCharacters
      });
    }

    const balanceBefore = await getBalance(req.apiKey.id);

    if (balanceBefore < EMBEDDING_COST) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: EMBEDDING_COST
      });
    }

    const result = await generateEmbedding(input);
    const balanceAfter = await spendCredits(req.apiKey.id, EMBEDDING_COST, "embedding_usage");

    if (balanceAfter === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: EMBEDDING_COST
      });
    }

    await recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/embeddings",
      usage: {
        ...result.usage,
        credits_used: EMBEDDING_COST,
        credits_remaining: balanceAfter
      }
    });

    res.json({
      success: true,
      model: result.model,
      data: result.embeddings,
      usage: result.usage,
      credits_used: EMBEDDING_COST,
      credits_remaining: balanceAfter
    });
  } catch (error) {
    console.error("4N DEV Embeddings Gateway error:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Embeddings error"
    });
  }
});

export default router;
