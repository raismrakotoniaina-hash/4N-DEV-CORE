import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { requirePlanFeature } from "../middleware/planFeature.js";
import { generateBuilderResponse } from "../aiGateway.js";
import { getProject, createProject } from "../projects.js";
import { upsertFile } from "../files.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits } from "../credits.js";
import { getServicePrice, getServiceLimit } from "../creditPolicy.js";

const router = express.Router();
const BUILDER_COST = getServicePrice("builder");
const BUILDER_LIMITS = getServiceLimit("builder");

function cleanFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter(file => file && typeof file.path === "string" && typeof file.content === "string")
    .map(file => ({
      path: file.path.trim().replaceAll("\\", "/"),
      content: file.content
    }))
    .filter(file =>
      file.path &&
      file.path.length <= 300 &&
      !file.path.startsWith("/") &&
      !file.path.includes("..") &&
      file.content.length <= 200000
    );
}

router.post("/builder", requireApiKey("coding"), requirePlanFeature("coding"), async (req, res) => {
  try {
    const { prompt, projectId, projectName } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }

    if (prompt.length > BUILDER_LIMITS.maxInputCharacters) {
      return res.status(413).json({
        success: false,
        error: "Builder prompt is too large",
        max_characters: BUILDER_LIMITS.maxInputCharacters
      });
    }

    const balanceBefore = getBalance(req.apiKey.id);
    if (balanceBefore < BUILDER_COST) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: BUILDER_COST
      });
    }

    let project = null;
    if (projectId) {
      project = getProject(req.apiKey.id, projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: "Project not found" });
      }
    }

    const result = await generateBuilderResponse({
      prompt,
      project: project ? { id: project.id, name: project.name, description: project.description } : null
    });

    const files = cleanFiles(result.files);
    if (!files.length) {
      return res.status(502).json({
        success: false,
        error: "Builder returned no valid files"
      });
    }

    if (!project) {
      const name = typeof projectName === "string" && projectName.trim()
        ? projectName.trim().slice(0, 120)
        : (typeof result.name === "string" && result.name.trim()
          ? result.name.trim().slice(0, 120)
          : "AI Builder Project");

      project = createProject(req.apiKey.id, name, typeof result.description === "string" ? result.description.slice(0, 2000) : "");
    }

    const savedFiles = files.map(file =>
      upsertFile(req.apiKey.id, project.id, file.path, file.content)
    );

    const balanceAfter = spendCredits(req.apiKey.id, BUILDER_COST, "builder_usage");
    if (balanceAfter === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balanceBefore,
        credits_required: BUILDER_COST
      });
    }

    recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/builder",
      usage: {
        ...result.usage,
        credits_used: BUILDER_COST,
        credits_remaining: balanceAfter,
        files_generated: savedFiles.length
      }
    });

    res.json({
      success: true,
      project,
      files: savedFiles,
      summary: result.summary || "",
      model: result.model,
      usage: result.usage,
      credits_used: BUILDER_COST,
      credits_remaining: balanceAfter
    });
  } catch (error) {
    console.error("4N DEV Builder Gateway error:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "AI Builder error"
    });
  }
});

export default router;
