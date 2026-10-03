import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getProject } from "../projects.js";
import {
  listFiles,
  getFile,
  upsertFile,
  deleteFile
} from "../files.js";

const router = express.Router();

router.use(requireApiKey());

function validatePath(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().replaceAll("\\", "/");
  if (!normalized || normalized.length > 300) return false;
  if (normalized.startsWith("/") || normalized.includes("..")) return false;
  return true;
}

router.get("/projects/:projectId/files", async (req, res, next) => {
  try {
    const project = await getProject(req.apiKey.id, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    res.json({ success: true, files: await listFiles(req.apiKey.id, req.params.projectId) });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:projectId/files", async (req, res, next) => {
  try {
    const project = await getProject(req.apiKey.id, req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const filePath = typeof req.body?.path === "string"
      ? req.body.path.trim().replaceAll("\\", "/")
      : "";
    const content = typeof req.body?.content === "string" ? req.body.content : "";

    if (!validatePath(filePath)) {
      return res.status(400).json({ success: false, error: "Invalid file path" });
    }

    if (content.length > 200000) {
      return res.status(400).json({
        success: false,
        error: "File content must be 200000 characters or less"
      });
    }

    const file = await upsertFile(req.apiKey.id, req.params.projectId, filePath, content);
    res.status(201).json({ success: true, file });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:projectId/files/:fileId", async (req, res, next) => {
  try {
    const file = await getFile(req.apiKey.id, req.params.projectId, req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    res.json({ success: true, file });
  } catch (error) {
    next(error);
  }
});

router.put("/projects/:projectId/files/:fileId", async (req, res, next) => {
  try {
    const current = await getFile(req.apiKey.id, req.params.projectId, req.params.fileId);
    if (!current) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    const filePath = typeof req.body?.path === "string"
      ? req.body.path.trim().replaceAll("\\", "/")
      : current.path;
    const content = typeof req.body?.content === "string" ? req.body.content : "";

    if (!validatePath(filePath) || content.length > 200000) {
      return res.status(400).json({
        success: false,
        error: "Invalid path or file content too large"
      });
    }

    const file = await upsertFile(req.apiKey.id, req.params.projectId, filePath, content);
    if (file.id !== current.id) {
      await deleteFile(req.apiKey.id, req.params.projectId, current.id);
    }

    res.json({ success: true, file });
  } catch (error) {
    next(error);
  }
});

router.delete("/projects/:projectId/files/:fileId", async (req, res, next) => {
  try {
    const deleted = await deleteFile(req.apiKey.id, req.params.projectId, req.params.fileId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "File not found" });
    }
    res.json({ success: true, deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
