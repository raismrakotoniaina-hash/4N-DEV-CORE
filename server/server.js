import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createApiKey } from "./apiKeys.js";
import { addCredits, getBalance } from "./credits.js";
import { requireApiKey } from "./middleware/apiKey.js";
import { getPlan } from "./plans.js";
import chatRouter from "./routes/chat.js";
import codingRouter from "./routes/coding.js";
import imageRouter from "./routes/image.js";
import embeddingsRouter from "./routes/embeddings.js";
import creditsRouter from "./routes/credits.js";
import plansRouter from "./routes/plans.js";
import creditPolicyRouter from "./routes/creditPolicy.js";
import projectsRouter from "./routes/projects.js";
import filesRouter from "./routes/files.js";
import builderRouter from "./routes/builder.js";
import billingRouter from "./routes/billing.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(express.json({\n  limit: "2mb",\n  verify: (req, _res, buffer) => {\n    req.rawBody = Buffer.from(buffer);\n  }\n}));

app.get("/health", (_req, res) => {
  res.json({ success: true, name: "4N DEV Core API", status: "online", version: "0.1.0" });
});

app.get("/v1", (_req, res) => {
  res.json({
    name: "4N DEV API",
    version: "v1",
    endpoints: ["/v1/chat", "/v1/coding", "/v1/image", "/v1/credits", "/v1/plans", "/v1/credit-policy", "/v1/embeddings", "/v1/projects", "/v1/files"]
  });
});

app.post("/v1/keys", (req, res) => {
  const adminSecret = process.env.CORE_ADMIN_SECRET;
  const suppliedSecret = req.get("x-core-admin-secret");

  if (!adminSecret || adminSecret === "change-this-before-use") {
    return res.status(503).json({ success: false, error: "CORE_ADMIN_SECRET is not configured" });
  }

  if (!suppliedSecret || suppliedSecret !== adminSecret) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const { name, scopes, planId } = req.body || {};
  const selectedPlan = getPlan(["free", "starter", "pro", "premium"].includes(planId) ? planId : "free");
  const allowedScopes = ["chat", "coding", "image", "embeddings"];
  const defaultScopes = selectedPlan.features.filter((feature) => allowedScopes.includes(feature));

  const apiKey = createApiKey({
    name: typeof name === "string" && name.trim() ? name.trim() : "Developer",
    scopes: Array.isArray(scopes) && scopes.length ? scopes : defaultScopes,
    planId: selectedPlan.id
  });

  addCredits(apiKey.id, selectedPlan.credits, `plan_${selectedPlan.id}`);

  res.status(201).json({
    success: true,
    message: "Store this API key securely. It will not be returned again.",
    api_key: apiKey.key,
    id: apiKey.id,
    name: apiKey.name,
    plan: selectedPlan.id,
    credits: selectedPlan.credits,
    scopes: apiKey.scopes,
    features: selectedPlan.features,
    createdAt: apiKey.createdAt
  });
});

app.get("/v1/me", requireApiKey, (req, res) => {
  const plan = getPlan(req.apiKey.planId || "free");
  res.json({
    success: true,
    developer: {
      id: req.apiKey.id,
      name: req.apiKey.name,
      plan: plan?.id || "free",
      features: plan?.features || [],
      scopes: req.apiKey.scopes,
      credits: getBalance(req.apiKey.id),
      active: req.apiKey.active,
      createdAt: req.apiKey.createdAt
    }
  });
});

app.use("/v1", chatRouter);
app.use("/v1", codingRouter);
app.use("/v1", imageRouter);
app.use("/v1", embeddingsRouter);
app.use("/v1", creditsRouter);
app.use("/v1", plansRouter);
app.use("/v1", creditPolicyRouter);
app.use("/v1/projects", projectsRouter);
app.use("/v1", filesRouter);
app.use("/v1", builderRouter);
app.use("/v1/billing", billingRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`4N DEV Core API running on port ${PORT}`);
});
