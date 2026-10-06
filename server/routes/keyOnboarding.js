import { createApiKey } from "../apiKeys.js";
import { addCredits } from "../credits.js";
import { getPlan } from "../plans.js";

const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

function onboardingLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }

  current.count += 1;

  if (current.count > MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      error: "Too many API key creation attempts",
      retry_after_seconds: retryAfter
    });
  }

  return next();
}

export function registerKeyOnboarding(app) {
  app.post("/v1/keys/create", onboardingLimit, async (req, res, next) => {
    try {
      const rawName = req.body?.name;
      const name = typeof rawName === "string" ? rawName.trim() : "";

      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Developer name is required"
        });
      }

      if (name.length > 80) {
        return res.status(400).json({
          success: false,
          error: "Developer name must be 80 characters or fewer"
        });
      }

      const plan = getPlan("free");
      const scopes = plan.features.filter((feature) =>
        ["chat", "coding", "image", "embeddings"].includes(feature)
      );

      const apiKey = await createApiKey({
        name,
        scopes,
        planId: plan.id
      });

      await addCredits(apiKey.id, plan.credits, "developer_onboarding");

      return res.status(201).json({
        success: true,
        message: "Store this API key securely. It will not be returned again.",
        api_key: apiKey.key,
        id: apiKey.id,
        name: apiKey.name,
        plan: plan.id,
        credits: plan.credits,
        scopes: apiKey.scopes,
        features: plan.features,
        createdAt: apiKey.createdAt
      });
    } catch (error) {
      return next(error);
    }
  });
}
