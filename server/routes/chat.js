import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { generateChatResponse } from "../aiGateway.js";
import { recordUsage } from "../usage.js";

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

    const result = await generateChatResponse(input);

    recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/chat",
      usage: result.usage
    });

    res.json({
      success: true,
      id: result.id,
      model: result.model,
      output: result.text,
      usage: result.usage
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
