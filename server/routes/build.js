import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getProject } from "../projects.js";
import { listFiles } from "../files.js";
import { buildProject, getBuild, listBuilds } from "../build.js";

const router = express.Router();

router.use(requireApiKey("coding"));

router.post("/builds", async (req, res) => {
  try {
    const projectId = typeof req.body?.projectId === "string"
      ? req.body.projectId.trim()
      : "";

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: "projectId is required"
      });
    }

    const project = await getProject(req.apiKey.id, projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }

    const files = await listFiles(req.apiKey.id, projectId);
    const build = await buildProject(req.apiKey.id, project, files);

    return res.status(201).json({
      success: true,
      build: {
        id: build.id,
        projectId: build.projectId,
        projectName: build.projectName,
        type: build.type,
        status: build.status,
        entrypoint: build.entrypoint,
        fileCount: build.fileCount,
        totalCharacters: build.totalCharacters,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "Build failed"
    });
  }
});

router.get("/builds", async (req, res, next) => {
  const projectId = typeof req.query.projectId === "string"
    ? req.query.projectId.trim()
    : null;

  res.json({
    success: true,
    builds: await listBuilds(req.apiKey.id, projectId)
  });
});

router.get("/builds/:buildId", async (req, res, next) => {
  const build = await getBuild(req.apiKey.id, req.params.buildId);
  if (!build) {
    return res.status(404).json({
      success: false,
      error: "Build not found"
    });
  }

  res.json({
    success: true,
    build: {
      id: build.id,
      projectId: build.projectId,
      projectName: build.projectName,
      type: build.type,
      status: build.status,
      entrypoint: build.entrypoint,
      fileCount: build.fileCount,
      totalCharacters: build.totalCharacters,
      createdAt: build.createdAt,
      updatedAt: build.updatedAt
    }
  });
});

export default router;
