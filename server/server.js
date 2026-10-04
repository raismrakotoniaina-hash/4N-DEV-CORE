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
import { checkDatabase, initializeDatabase } from "./db.js";
import { createRequestId, logError, logInfo, logRequest, sanitizeError } from "./logger.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.disable("x-powered-by");

app.use(helmet());
app.use(cors());

app.use((req, res, next) => {
  const requestId = req.get("x-request-id") || createRequestId();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logRequest({
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userAgent: req.get("user-agent") || undefined
    });
  });

  next();
});

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

app.get("/health/db", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      status: "unavailable",
      database: "not_configured"
    });
  }

  try {
    await checkDatabase();
    return res.json({
      success: true,
      status: "online",
      database: "connected"
    });
  } catch (error) {
    logError("database_health_check_failed", {
      requestId: req.requestId,
      error: sanitizeError(error)
    });
    return res.status(503).json({
      success: false,
      status: "unavailable",
      database: "disconnected"
    });
  }
});

app.get("/health/ready", async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      status: "not_ready",
      checks: {
        database: "not_configured"
      },
      requestId: req.requestId
    });
  }

  try {
    await checkDatabase();

    return res.json({
      success: true,
      status: "ready",
      checks: {
        database: "connected"
      },
      requestId: req.requestId
    });
  } catch (error) {
    logError("readiness_check_failed", {
      requestId: req.requestId,
      error: sanitizeError(error)
    });

    return res.status(503).json({
      success: false,
      status: "not_ready",
      checks: {
        database: "disconnected"
      },
      requestId: req.requestId
    });
  }
});

app.get("/v1", (_req, res) => {
  res.json({
    name: "4N DEV API",
    version: "v1",
    endpoints: ["/v1/chat", "/v1/coding", "/v1/image", "/v1/credits", "/v1/plans", "/v1/credit-policy", "/v1/embeddings", "/v1/projects", "/v1/files", "/v1/hosting/deployments", "/v1/builds"]
  });
});

app.post("/v1/keys", async (req, res, next) => {
  try {
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

    const apiKey = await createApiKey({
      name: typeof name === "string" && name.trim() ? name.trim() : "Developer",
      scopes: Array.isArray(scopes) && scopes.length ? scopes : defaultScopes,
      planId: selectedPlan.id
    });

    await addCredits(apiKey.id, selectedPlan.credits, `plan_${selectedPlan.id}`);

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
  } catch (error) {
    next(error);
  }
});

app.get("/v1/keys", requireApiKey(), async (req, res, next) => {
  try {
    const keys = (await listApiKeys(req.apiKey.id)).map(({ hash, ...safe }) => safe);
    res.json({ success: true, keys });
  } catch (error) {
    next(error);
  }
});

app.patch("/v1/keys/:keyId", requireApiKey(), async (req, res, next) => {
  try {
    if (req.params.keyId !== req.apiKey.id) {
      return res.status(403).json({ success: false, error: "Cannot modify another API key" });
    }
    if (typeof req.body?.active !== "boolean") {
      return res.status(400).json({ success: false, error: "active must be a boolean" });
    }
    const updated = await setApiKeyActive(req.apiKey.id, req.body.active);
    if (!updated) return res.status(404).json({ success: false, error: "API key not found" });
    res.json({ success: true, key: { id: updated.id, name: updated.name, planId: updated.planId, scopes: updated.scopes, active: updated.active, createdAt: updated.createdAt, updatedAt: updated.updatedAt } });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/me", requireApiKey(), async (req, res, next) => {
  try {
    const plan = getPlan(req.apiKey.planId || "free");
    res.json({
      success: true,
      developer: {
        id: req.apiKey.id,
        name: req.apiKey.name,
        plan: plan?.id || "free",
        features: plan?.features || [],
        scopes: req.apiKey.scopes,
        credits: await getBalance(req.apiKey.id),
        active: req.apiKey.active,
        createdAt: req.apiKey.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// Billing routes MUST be registered before generic /v1 routers.
app.use("/v1/billing", billingRouter);
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

app.use((err, req, res, _next) => {
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  logError("request_failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    error: sanitizeError(err)
  });

  if (res.headersSent) {
    return;
  }

  res.status(status).json({
    success: false,
    error: status >= 500 ? "Internal server error" : (err.message || "Request failed"),
    requestId: req.requestId
  });
});

async function startServer() {
  try {
    if (process.env.DATABASE_URL) {
      await initializeDatabase();
      logInfo("postgresql_database_initialized");
    } else {
      logInfo("postgresql_not_configured_using_local_development_storage");
    }

    app.listen(PORT, "0.0.0.0", () => {
      logInfo("server_started", { port: PORT, environment: process.env.NODE_ENV || "development" });
    });
  } catch (error) {
    logError("database_initialization_failed", { error: sanitizeError(error) });
    process.exit(1);
  }
}

startServer();
