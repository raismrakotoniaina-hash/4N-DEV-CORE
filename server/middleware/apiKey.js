import { authenticateApiKey } from "../apiKeys.js";

export function requireApiKey(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, key] = header.split(" ");

  if (scheme !== "Bearer" || !key) {
    return res.status(401).json({
      success: false,
      error: "Missing 4N DEV API key"
    });
  }

  const apiKey = authenticateApiKey(key);

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Invalid or revoked 4N DEV API key"
    });
  }

  req.apiKey = apiKey;
  next();
}
