import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getProject } from "../projects.js";
import { getBuild } from "../build.js";
import { listFiles } from "../files.js";
import {
  createDeployment,
  listDeployments,
  getDeployment,
  listDeploymentHistory,
  rollbackDeployment,
  deleteDeployment
} from "../hosting.js";

const router = express.Router();

router.use(requireApiKey());

router.post("/deployments", (req, res) => {
  const projectId = typeof req.body?.projectId === "string"
    ? req.body.projectId.trim()
    : "";

  if (!projectId) {
    return res.status(400).json({
      success: false,
      error: "projectId is required"
    });
  }

  const project = getProject(req.apiKey.id, projectId);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: "Project not found"
    });
  }

  const buildId = typeof req.body?.buildId === "string" ? req.body.buildId.trim() : "";
  let files;

  if (buildId) {
    const build = getBuild(req.apiKey.id, buildId);
    if (!build || build.projectId !== projectId) {
      return res.status(404).json({
        success: false,
        error: "Build not found for project"
      });
    }
    if (build.status !== "built") {
      return res.status(400).json({
        success: false,
        error: "Build is not ready for deployment"
      });
    }
    files = build.files;
  } else {
    files = listFiles(req.apiKey.id, projectId);
  }

  if (!files.some(file => file.path === "index.html")) {
    return res.status(400).json({
      success: false,
      error: "Project must contain index.html before deployment"
    });
  }

  const deployment = createDeployment(req.apiKey.id, project, files);

  res.status(201).json({
    success: true,
    deployment: {
      id: deployment.id,
      projectId: deployment.projectId,
      projectName: deployment.projectName,
      slug: deployment.slug,
      status: deployment.status,
      version: deployment.version,
      url: `/sites/${deployment.slug}`,
      fileCount: deployment.files.length,
      buildId: buildId || null,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt
    }
  });
});

router.get("/deployments", (req, res) => {
  res.json({
    success: true,
    deployments: listDeployments(req.apiKey.id)
  });
});

router.get("/deployments/:deploymentId", (req, res) => {
  const deployment = getDeployment(req.apiKey.id, req.params.deploymentId);
  if (!deployment) {
    return res.status(404).json({
      success: false,
      error: "Deployment not found"
    });
  }

  res.json({
    success: true,
    deployment: {
      id: deployment.id,
      projectId: deployment.projectId,
      projectName: deployment.projectName,
      slug: deployment.slug,
      status: deployment.status,
      version: deployment.version,
      url: `/sites/${deployment.slug}`,
      fileCount: deployment.files.length,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt
    }
  });
});

router.get("/deployments/:deploymentId/history", (req, res) => {
  const history = listDeploymentHistory(req.apiKey.id, req.params.deploymentId);
  if (!history) {
    return res.status(404).json({
      success: false,
      error: "Deployment not found"
    });
  }

  res.json({
    success: true,
    deployment_id: req.params.deploymentId,
    history
  });
});

router.post("/deployments/:deploymentId/rollback", (req, res) => {
  const version = Number(req.body?.version);
  if (!Number.isInteger(version) || version < 1) {
    return res.status(400).json({
      success: false,
      error: "version must be a positive integer"
    });
  }

  const deployment = rollbackDeployment(
    req.apiKey.id,
    req.params.deploymentId,
    version
  );

  if (!deployment) {
    return res.status(404).json({
      success: false,
      error: "Deployment or version not found"
    });
  }

  res.json({
    success: true,
    deployment: {
      id: deployment.id,
      projectId: deployment.projectId,
      slug: deployment.slug,
      status: deployment.status,
      version: deployment.version,
      url: `/sites/${deployment.slug}`,
      updatedAt: deployment.updatedAt
    }
  });
});

router.delete("/deployments/:deploymentId", (req, res) => {
  const deleted = deleteDeployment(req.apiKey.id, req.params.deploymentId);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: "Deployment not found"
    });
  }

  res.json({
    success: true,
    deployment_id: req.params.deploymentId,
    status: "unpublished"
  });
});

export default router;
