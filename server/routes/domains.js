import express from "express";
import { requireApiKey } from "../middleware/apiKey.js";
import { getDeployment } from "../hosting.js";
import { createDomain, listDomains, verifyDomain, deleteDomain } from "../domains.js";

const router = express.Router();
router.use(requireApiKey());

router.post("/", async (req, res, next) => {
  try {
    const deploymentId = typeof req.body?.deploymentId === "string" ? req.body.deploymentId.trim() : "";
    const domainName = typeof req.body?.domain === "string" ? req.body.domain : "";
    if (!deploymentId || !domainName) {
      return res.status(400).json({ success: false, error: "deploymentId and domain are required." });
    }
    const deployment = await getDeployment(req.apiKey.id, deploymentId);
    if (!deployment || deployment.status !== "deployed") {
      return res.status(404).json({ success: false, error: "Active deployment not found for this API key." });
    }
    const result = await createDomain(req.apiKey.id, deploymentId, domainName);
    if (result.error) return res.status(409).json({ success: false, error: result.error });
    const domain = result.domain;
    res.status(201).json({
      success: true,
      domain: {
        id: domain.id, domain: domain.domain, deploymentId: domain.deploymentId,
        status: domain.status, createdAt: domain.createdAt,
        dns: {
          type: "TXT",
          name: "_4ndev-verify." + domain.domain,
          value: domain.verificationToken
        },
        nextStep: "Add the TXT record at your DNS provider, wait for DNS propagation, then POST /v1/hosting/domains/" + domain.id + "/verify."
      }
    });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const domains = await listDomains(req.apiKey.id);
    res.json({ success: true, domains });
  } catch (error) { next(error); }
});

router.post("/:domainId/verify", async (req, res, next) => {
  try {
    const result = await verifyDomain(req.apiKey.id, req.params.domainId);
    if (result.error) return res.status(result.code === "DNS_TXT_NOT_FOUND" ? 409 : 400).json({ success: false, error: result.error, code: result.code });
    res.json({ success: true, domain: result.domain, note: "DNS ownership is verified. HTTPS must still be configured for this hostname before production use." });
  } catch (error) { next(error); }
});

router.delete("/:domainId", async (req, res, next) => {
  try {
    const deleted = await deleteDomain(req.apiKey.id, req.params.domainId);
    if (!deleted) return res.status(404).json({ success: false, error: "Domain not found." });
    res.json({ success: true, deleted: true });
  } catch (error) { next(error); }
});

export default router;
