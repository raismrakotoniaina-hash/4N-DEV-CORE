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
import usageRouter from "./routes/usage.js";
import hostingRouter from "./routes/hosting.js";
import buildRouter from "./routes/build.js";
import sitesRouter from "./routes/sites.js";
import { listApiKeys, setApiKeyActive } from "./apiKeys.js";
import { apiRateLimit } from "./middleware/rateLimit.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));

app.get("/payment/success", (req, res) => {
  res.json({
    success: true,
    payment_status: "success",
    message: "Payment completed. The provider webhook confirms credit fulfillment."
  });
});

app.get("/payment/failure", (req, res) => {
  res.json({
    success: false,
    payment_status: "failure",
    message: "Payment was not completed."
  });
});

app.get("/health", (_req, res) => {
  res.json({ success: true, name: "4N DEV Core API", status: "online", version: "0.1.0" });
});

app.get("/v1", (_req, res) => {
  res.json({
    name: "4N DEV API",
    version: "v1",
    endpoints: ["/v1/chat", "/v1/coding", "/v1/image", "/v1/credits", "/v1/plans", "/v1/credit-policy", "/v1/embeddings", "/v1/projects", "/v1/files", "/v1/hosting/deployments", "/v1/builds"]
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

app.get("/v1/keys", requireApiKey(), (req, res) => {
  const keys = listApiKeys(req.apiKey.id).map(({ hash, ...safe }) => safe);
  res.json({ success: true, keys });
});

app.patch("/v1/keys/:keyId", requireApiKey(), (req, res) => {
  if (req.params.keyId !== req.apiKey.id) {
    return res.status(403).json({ success: false, error: "Cannot modify another API key" });
  }
  if (typeof req.body?.active !== "boolean") {
    return res.status(400).json({ success: false, error: "active must be a boolean" });
  }
  const updated = setApiKeyActive(req.apiKey.id, req.body.active);
  if (!updated) return res.status(404).json({ success: false, error: "API key not found" });
  res.json({ success: true, key: { id: updated.id, name: updated.name, planId: updated.planId, scopes: updated.scopes, active: updated.active, createdAt: updated.createdAt, updatedAt: updated.updatedAt } });
});

app.get("/v1/me", requireApiKey(), (req, res) => {
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

// Billing routes MUST be registered before generic /v1 routers.
// Otherwise a generic API-key middleware can intercept the public PAPI webhook.
app.use("/v1/billing", billingRouter);

// Published client sites are public; deployment management remains API-key protected.
app.use("/sites", sitesRouter);

app.use("/v1", apiRateLimit);
app.use("/v1", chatRouter);
app.use("/v1", codingRouter);
app.use("/v1", imageRouter);
app.use("/v1", embeddingsRouter);
app.use("/v1", creditsRouter);
app.use("/v1", usageRouter);
app.use("/v1", plansRouter);
app.use("/v1", creditPolicyRouter);
app.use("/v1/projects", projectsRouter);
app.use("/v1", filesRouter);
app.use("/v1", builderRouter);
app.use("/v1/hosting", hostingRouter);
app.use("/v1", buildRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`4N DEV Core API running on port ${PORT}`);
});
