import crypto from "node:crypto";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|api[-_]?key|database[-_]?url|openai|papi)/i;

function sanitize(value, depth = 0) {
  if (depth > 4) return "[TRUNCATED]";

  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  }
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : sanitize(item, depth + 1);
  }
  return output;
}

function write(level, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields)
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "fatal") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function logInfo(message, fields = {}) {
  write("info", message, fields);
}

export function logWarn(message, fields = {}) {
  write("warn", message, fields);
}

export function logError(message, fields = {}) {
  write("error", message, fields);
}

export function logRequest(fields = {}) {
  write("info", "http_request", fields);
}

export function sanitizeError(error) {
  if (!error) return { message: "Unknown error" };

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}
