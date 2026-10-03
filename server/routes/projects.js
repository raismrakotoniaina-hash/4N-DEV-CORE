import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject
} from "../projects.js";

const router = express.Router();

router.use(requireApiKey());

router.get("/", async (req, res, next) => {
  try {
    res.json({ success: true, projects: await listProjects(req.apiKey.id) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";

    if (!name || name.length > 120) {
      return res.status(400).json({
        success: false,
        error: "Project name is required and must be 120 characters or less"
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Project description must be 2000 characters or less"
      });
    }

    const project = await createProject(req.apiKey.id, name, description);
    res.status(201).json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

router.get("/:projectId", async (req, res, next) => {
  try {
    const project = await getProject(req.apiKey.id, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

router.patch("/:projectId", async (req, res, next) => {
  try {
    const project = await updateProject(req.apiKey.id, req.params.projectId, req.body || {});
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

router.delete("/:projectId", async (req, res, next) => {
  try {
    const deleted = await deleteProject(req.apiKey.id, req.params.projectId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
