import express from "express";
import { getPublicDeployment, findDeploymentFile } from "../hosting.js";

const router = express.Router();

const contentTypes = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon"
};

router.use("/:slug", async (req, res, next) => {
  try {
    const deployment = await getPublicDeployment(req.params.slug);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: "Published site not found"
      });
    }

    const requestedPath = req.path.replace(/^\/+/, "") || "index.html";
    const file = findDeploymentFile(deployment, requestedPath);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: "Published file not found"
      });
    }

    const extension = file.path.includes(".")
      ? file.path.split(".").pop().toLowerCase()
      : "";

    res.type(contentTypes[extension] || "application/octet-stream");
    if (file.encoding === "base64") {
      return res.send(Buffer.from(file.content, "base64"));
    }
    res.send(file.content);
  } catch (error) {
    next(error);
  }
});

const customDomainRouter = express.Router();

customDomainRouter.use(async (req, res, next) => {
  try {
    const hostname = String(req.hostname || "").toLowerCase().replace(/\\.$/, "");
    const deployment = await (await import("../domains.js")).getPublicDomainDeployment(hostname);
    if (!deployment) return next();

    const requestedPath = req.path.replace(/^\\/+/, "") || "index.html";
    const file = findDeploymentFile(deployment, requestedPath);
    if (!file) return res.status(404).type("text/plain").send("Published file not found");

    const extension = file.path.includes(".") ? file.path.split(".").pop().toLowerCase() : "";
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(contentTypes[extension] || "application/octet-stream");
    if (file.encoding === "base64") return res.send(Buffer.from(file.content, "base64"));
    return res.send(file.content);
  } catch (error) {
    next(error);
  }
});

export { customDomainRouter };

export default router;
