import express from "express";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 60);

const buckets = new Map();

export function apiRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
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
      error: "Rate limit exceeded",
      retry_after_seconds: retryAfter,
      limit: MAX_REQUESTS,
      window_seconds: Math.ceil(WINDOW_MS / 1000)
    });
  }

  return next();
}

export function resetRateLimitStore() {
  buckets.clear();
}
