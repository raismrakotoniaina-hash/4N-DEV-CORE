import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { requirePlanFeature } from "../middleware/planFeature.js";
import { generateBuilderResponse, generateBuilderPlan, repairBuilderFiles } from "../aiGateway.js";
import { getProject, createProject } from "../projects.js";
import { upsertFile } from "../files.js";
import { createDeployment } from "../hosting.js";
import { buildProject } from "../build.js";
import { recordUsage } from "../usage.js";
import { getBalance, spendCredits, refundCredits } from "../credits.js";
import { getServicePrice, getServiceLimit } from "../creditPolicy.js";

const router = express.Router();
const BUILDER_COST = getServicePrice("builder");
const BUILDER_LIMITS = getServiceLimit("builder");
const PLANNER_COST = getServicePrice("planner");
const PLANNER_LIMITS = getServiceLimit("planner");

function reviewGeneratedFiles(files) {
  const paths = new Set(files.map(file => file.path));
  const issues = [];
  const warnings = [];

  if (!paths.has("index.html")) {
    issues.push("Missing index.html entry point");
  }

  const htmlFiles = files.filter(file => /\.html$/i.test(file.path));
  const jsFiles = files.filter(file => /\.js$/i.test(file.path));
  const cssFiles = files.filter(file => /\.css$/i.test(file.path));

  for (const file of htmlFiles) {
    if (!/<html[\s>]/i.test(file.content)) issues.push(`Invalid HTML document structure: ${file.path}`);
    if (!/<meta[^>]+viewport/i.test(file.content)) warnings.push(`Missing mobile viewport: ${file.path}`);
  }

  for (const file of jsFiles) {
    if (/TODO|coming soon|placeholder/i.test(file.content)) warnings.push(`Placeholder text detected: ${file.path}`);
  }

  for (const file of cssFiles) {
    if (file.content.length < 40) warnings.push(`Very small stylesheet: ${file.path}`);
  }

  const allContent = files.map(file => file.content).join("\\n");
  if (/4ndev_sk_|CORE_API_KEY|OPENAI_API_KEY|sk-[A-Za-z0-9_-]{20,}/i.test(allContent)) {
    issues.push("Potential secret or API key detected in generated files");
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    files_checked: files.length,
    checks: {
      entry_point: paths.has("index.html"),
      html_structure: htmlFiles.every(file => /<html[\s>]/i.test(file.content)),
      no_embedded_secrets: !issues.some(issue => /secret|api key/i.test(issue))
    }
  };
}

function cleanFiles(files) {
  if (!Array.isArray(files)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const file of files) {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") continue;

    const filePath = file.path.trim().replaceAll("\\", "/");
    if (
      !filePath ||
      filePath.length > 300 ||
      filePath.startsWith("/") ||
      filePath.includes("..") ||
      filePath.includes("\\0") ||
      file.content.length > 200000
    ) continue;

    if (seen.has(filePath)) continue;
    seen.add(filePath);
    cleaned.push({ path: filePath, content: file.content });
  }

  return cleaned;
}

router.post("/builder/plan", requireApiKey("coding"), requirePlanFeature("coding"), async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }

    if (prompt.length > PLANNER_LIMITS.maxInputCharacters) {
      return res.status(413).json({
        success: false,
        error: "Planner prompt is too large",
        max_characters: PLANNER_LIMITS.maxInputCharacters
      });
    }

    const balance = await getBalance(req.apiKey.id);
    if (balance < PLANNER_COST) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: balance,
        credits_required: PLANNER_COST
      });
    }

    const result = await generateBuilderPlan({ prompt });
    const remaining = await spendCredits(req.apiKey.id, PLANNER_COST, "builder_planner");

    if (remaining === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: await getBalance(req.apiKey.id),
        credits_required: PLANNER_COST
      });
    }

    await recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/builder/plan",
      usage: { ...result.usage, credits_used: PLANNER_COST, credits_remaining: remaining }
    });

    return res.json({
      success: true,
      plan: result.plan,
      model: result.model,
      usage: result.usage,
      credits_used: PLANNER_COST,
      credits_remaining: remaining
    });
  } catch (error) {
    console.error("4N DEV Builder Planner error:", error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "AI Builder Planner error"
    });
  }
});

router.post("/builder/review", requireApiKey("coding"), requirePlanFeature("coding"), async (req, res) => {
  try {
    const files = cleanFiles(req.body?.files);
    if (!files.length) {
      return res.status(400).json({ success: false, error: "files are required" });
    }

    const review = reviewGeneratedFiles(files);
    return res.json({ success: review.passed, review });
  } catch (error) {
    console.error("4N DEV Builder review error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Builder review error" });
  }
});

router.post("/builder", requireApiKey("coding"), requirePlanFeature("coding"), async (req, res) => {
  try {
    const { prompt, projectId, projectName, plan } = req.body || {};

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

    const balanceBefore = await getBalance(req.apiKey.id);
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
      project = await getProject(req.apiKey.id, projectId);
      if (!project) {
        return res.status(404).json({ success: false, error: "Project not found" });
      }
    }

    const result = await generateBuilderResponse({
      prompt,
      plan: plan && typeof plan === "object" ? plan : null,
      project: project ? { id: project.id, name: project.name, description: project.description } : null
    });

    const files = cleanFiles(result.files);
    if (!files.length) {
      return res.status(502).json({
        success: false,
        error: "Builder returned no valid files"
      });
    }

    if (files.length > BUILDER_LIMITS.maxFiles) {
      return res.status(502).json({
        success: false,
        error: "Builder returned too many files",
        max_files: BUILDER_LIMITS.maxFiles,
        files_returned: files.length
      });
    }

    const totalCharacters = files.reduce((sum, file) => sum + file.content.length, 0);
    if (totalCharacters > BUILDER_LIMITS.maxTotalCharacters) {
      return res.status(502).json({
        success: false,
        error: "Builder output is too large",
        max_total_characters: BUILDER_LIMITS.maxTotalCharacters
      });
    }

    let finalFiles = files;
    let review = reviewGeneratedFiles(finalFiles);
    let repair = { attempted: false, passed: review.passed };

    if (!review.passed) {
      repair.attempted = true;
      const repaired = await repairBuilderFiles({
        prompt,
        plan: plan && typeof plan === "object" ? plan : null,
        files: finalFiles,
        review
      });

      finalFiles = cleanFiles(repaired.files);
      if (!finalFiles.length || finalFiles.length > BUILDER_LIMITS.maxFiles) {
        return res.status(502).json({
          success: false,
          error: "Builder auto-fix returned invalid files",
          review,
          repair: { ...repair, passed: false, model: repaired.model }
        });
      }

      const repairedTotalCharacters = finalFiles.reduce((sum, file) => sum + file.content.length, 0);
      if (repairedTotalCharacters > BUILDER_LIMITS.maxTotalCharacters) {
        return res.status(502).json({
          success: false,
          error: "Builder auto-fix output is too large",
          review,
          repair: { ...repair, passed: false, model: repaired.model }
        });
      }

      review = reviewGeneratedFiles(finalFiles);
      repair = {
        attempted: true,
        passed: review.passed,
        model: repaired.model,
        summary: repaired.summary || ""
      };

      if (!review.passed) {
        return res.status(502).json({
          success: false,
          error: "Builder output failed quality review after auto-fix",
          review,
          repair
        });
      }
    }

    if (!project) {
      const name = typeof projectName === "string" && projectName.trim()
        ? projectName.trim().slice(0, 120)
        : (typeof result.name === "string" && result.name.trim()
          ? result.name.trim().slice(0, 120)
          : "AI Builder Project");

      project = await createProject(req.apiKey.id, name, typeof result.description === "string" ? result.description.slice(0, 2000) : "");
    }

    // Validate credit availability again immediately before persistence.
    // This prevents a stale balance check from allowing a build without credits.
    const balanceAfter = await spendCredits(req.apiKey.id, BUILDER_COST, "builder_usage");
    if (balanceAfter === null) {
      return res.status(402).json({
        success: false,
        error: "Insufficient 4N DEV credits",
        credits: await getBalance(req.apiKey.id),
        credits_required: BUILDER_COST
      });
    }

    let savedFiles;
    try {
      savedFiles = await Promise.all(finalFiles.map(file =>
        upsertFile(req.apiKey.id, project.id, file.path, file.content)
      ));
    } catch (error) {
      console.error("4N DEV Builder persistence error:", error.message);
      let creditsRefunded = false;
      try {
        await refundCredits(req.apiKey.id, BUILDER_COST, "builder_persistence_failure");
        creditsRefunded = true;
      } catch (refundError) {
        console.error("4N DEV Builder credit refund error:", refundError.message);
      }
      return res.status(500).json({
        success: false,
        error: "Builder output could not be saved after credit reservation",
        credits_refunded: creditsRefunded
      });
    }

    let build;
    try {
      build = await buildProject(req.apiKey.id, project, savedFiles);
    } catch (error) {
      console.error("4N DEV Builder build error:", error.message);
      let creditsRefunded = false;
      try {
        await refundCredits(req.apiKey.id, BUILDER_COST, "builder_build_failure");
        creditsRefunded = true;
      } catch (refundError) {
        console.error("4N DEV Builder credit refund error:", refundError.message);
      }
      return res.status(error.statusCode || 422).json({
        success: false,
        error: "Builder output was saved but the production build failed",
        project,
        files: savedFiles,
        review,
        repair,
        build_error: error.message,
        credits_refunded: creditsRefunded
      });
    }

    let deployment;
    try {
      deployment = await createDeployment(req.apiKey.id, project, build.files);
    } catch (error) {
      console.error("4N DEV Builder deployment error:", error.message);
      let creditsRefunded = false;
      try {
        await refundCredits(req.apiKey.id, BUILDER_COST, "builder_deployment_failure");
        creditsRefunded = true;
      } catch (refundError) {
        console.error("4N DEV Builder credit refund error:", refundError.message);
      }
      return res.status(500).json({
        success: false,
        error: "Builder output was built and saved but automatic deployment failed",
        project,
        files: savedFiles,
        build: {
          id: build.id,
          type: build.type,
          status: build.status,
          fileCount: build.fileCount
        },
        review,
        repair,
        credits_refunded: creditsRefunded
      });
    }

    await recordUsage({
      apiKeyId: req.apiKey.id,
      endpoint: "/v1/builder",
      usage: {
        ...result.usage,
        credits_used: BUILDER_COST,
        credits_remaining: balanceAfter,
        files_generated: savedFiles.length,
        build_id: build.id,
        deployment_id: deployment.id
      }
    });

    res.json({
      success: true,
      project,
      files: savedFiles,
      build: {
        id: build.id,
        type: build.type,
        status: build.status,
        entrypoint: build.entrypoint,
        fileCount: build.fileCount,
        totalCharacters: build.totalCharacters,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt
      },
      deployment: {
        id: deployment.id,
        projectId: deployment.projectId,
        slug: deployment.slug,
        status: deployment.status,
        url: `/sites/${deployment.slug}`,
        updatedAt: deployment.updatedAt
      },
      summary: result.summary || (plan && typeof plan.project_type === "string" ? `Planner-driven ${plan.project_type} project generated.` : ""),
      planner_project_type: plan?.project_type || null,
      review,
      repair,
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
