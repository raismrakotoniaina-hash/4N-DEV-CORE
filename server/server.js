import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createApiKey } from "./apiKeys.js";
import { requireApiKey } from "./middleware/apiKey.js";
import chatRouter from "./routes/chat.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    name: "4N DEV Core API",
    status: "online",
    version: "0.1.0"
  });
});

app.get("/v1", (_req, res) => {
  res.json({
    name: "4N DEV API",
    version: "v1",
    endpoints: [
      "/v1/chat",
      "/v1/coding",
      "/v1/image",
      "/v1/embeddings",
      "/v1/projects",
      "/v1/files"
    ]
  });
});

app.post("/v1/keys", (req, res) => {
  const adminSecret = process.env.CORE_ADMIN_SECRET;
  const suppliedSecret = req.get("x-core-admin-secret");

  if (!adminSecret || adminSecret === "change-this-before-use") {
    return res.status(503).json({
      success: false,
      error: "CORE_ADMIN_SECRET is not configured"
    });
  }

  if (!suppliedSecret || suppliedSecret !== adminSecret) {
    return res.status(403).json({
      success: false,
      error: "Forbidden"
    });
  }

  const { name, scopes } = req.body || {};
  const apiKey = createApiKey({
    name: typeof name === "string" && name.trim() ? name.trim() : "Developer",
    scopes: Array.isArray(scopes) && scopes.length ? scopes : ["chat"]
  });

  res.status(201).json({
    success: true,
    message: "Store this API key securely. It will not be returned again.",
    api_key: apiKey.key,
    id: apiKey.id,
    name: apiKey.name,
    scopes: apiKey.scopes,
    createdAt: apiKey.createdAt
  });
});

app.get("/v1/me", requireApiKey, (req, res) => {
  res.json({
    success: true,
    developer: {
      id: req.apiKey.id,
      name: req.apiKey.name,
      scopes: req.apiKey.scopes,
      active: req.apiKey.active,
      createdAt: req.apiKey.createdAt
    }
  });
});

app.use("/v1", chatRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`4N DEV Core API running on port ${PORT}`);
});
