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

router.get("/", (req, res) => {
  res.json({ success: true, projects: listProjects(req.apiKey.id) });
});

router.post("/", (req, res) => {
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

  const project = createProject(req.apiKey.id, name, description);
  res.status(201).json({ success: true, project });
});

router.get("/:projectId", (req, res) => {
  const project = getProject(req.apiKey.id, req.params.projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: "Project not found" });
  }
  res.json({ success: true, project });
});

router.patch("/:projectId", (req, res) => {
  const project = updateProject(req.apiKey.id, req.params.projectId, req.body || {});
  if (!project) {
    return res.status(404).json({ success: false, error: "Project not found" });
  }
  res.json({ success: true, project });
});

router.delete("/:projectId", (req, res) => {
  const deleted = deleteProject(req.apiKey.id, req.params.projectId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: "Project not found" });
  }
  res.json({ success: true, deleted: true });
});

export default router;
