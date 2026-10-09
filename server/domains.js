import crypto from "node:crypto";
import dns from "node:dns/promises";
import { isDatabaseConfigured, query } from "./db.js";
import { readStore, updateStore } from "./localStore.js";

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  if (!domain || domain.length > 253 || domain.includes("://") || domain.includes("/") || domain.includes(":")) return null;
  if (domain === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return domain;
}

function mapRow(row) {
  return {
    id: row.id, apiKeyId: row.api_key_id, deploymentId: row.deployment_id,
    domain: row.domain, verificationToken: row.verification_token,
    status: row.status, verifiedAt: row.verified_at, createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapLocal(row) {
  return {
    id: row.id, apiKeyId: row.apiKeyId, deploymentId: row.deploymentId,
    domain: row.domain, verificationToken: row.verificationToken,
    status: row.status, verifiedAt: row.verifiedAt, createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function cleanDomain(value) { return normalizeDomain(value); }

export async function createDomain(apiKeyId, deploymentId, inputDomain) {
  const domain = normalizeDomain(inputDomain);
  if (!domain) return { error: "Invalid domain. Enter a hostname such as www.example.com." };
  const token = "4ndev-domain-verification=" + crypto.randomBytes(24).toString("hex");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (isDatabaseConfigured()) {
    const duplicate = await query("SELECT id FROM custom_domains WHERE domain = $1 LIMIT 1", [domain]);
    if (duplicate.rowCount) return { error: "This domain is already registered in 4N DEV." };
    const result = await query(
      `INSERT INTO custom_domains
        (id, api_key_id, deployment_id, domain, verification_token, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'pending_verification',$6,$6) RETURNING *`,
      [id, apiKeyId, deploymentId, domain, token, now]
    );
    return { domain: mapRow(result.rows[0]) };
  }

  const state = await readStore();
  if (state.customDomains.some(item => item.domain === domain)) return { error: "This domain is already registered in 4N DEV." };
  const item = { id, apiKeyId, deploymentId, domain, verificationToken: token, status: "pending_verification", verifiedAt: null, createdAt: now, updatedAt: now };
  await updateStore(current => ({ ...current, customDomains: [...current.customDomains, item] }));
  return { domain: mapLocal(item) };
}

export async function listDomains(apiKeyId) {
  if (isDatabaseConfigured()) {
    const result = await query("SELECT * FROM custom_domains WHERE api_key_id = $1 ORDER BY created_at DESC", [apiKeyId]);
    return result.rows.map(mapRow).map(({ verificationToken, ...safe }) => ({ ...safe, verificationToken: verificationToken }));
  }
  const state = await readStore();
  return state.customDomains.filter(item => item.apiKeyId === apiKeyId).map(mapLocal);
}

export async function getDomain(apiKeyId, domainId) {
  if (isDatabaseConfigured()) {
    const result = await query("SELECT * FROM custom_domains WHERE id = $1 AND api_key_id = $2 LIMIT 1", [domainId, apiKeyId]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  const state = await readStore();
  const item = state.customDomains.find(item => item.id === domainId && item.apiKeyId === apiKeyId);
  return item ? mapLocal(item) : null;
}

export async function verifyDomain(apiKeyId, domainId) {
  const item = await getDomain(apiKeyId, domainId);
  if (!item) return { error: "Domain not found." };
  const recordName = "_4ndev-verify." + item.domain;
  let records = [];
  try {
    records = await dns.resolveTxt(recordName);
  } catch (error) {
    return { error: "DNS TXT record was not found yet. Add the TXT record and try again.", code: "DNS_TXT_NOT_FOUND" };
  }
  const values = records.flat().map(value => String(value).trim());
  if (!values.includes(item.verificationToken)) {
    return { error: "DNS TXT record exists but does not match this domain's verification token.", code: "DNS_TXT_MISMATCH" };
  }
  const now = new Date().toISOString();
  if (isDatabaseConfigured()) {
    const result = await query(
      "UPDATE custom_domains SET status = 'verified', verified_at = $1, updated_at = $1 WHERE id = $2 AND api_key_id = $3 RETURNING *",
      [now, domainId, apiKeyId]
    );
    return result.rows[0] ? { domain: mapRow(result.rows[0]) } : { error: "Domain not found." };
  }
  let updated = null;
  await updateStore(state => ({
    ...state,
    customDomains: state.customDomains.map(domain => {
      if (domain.id !== domainId || domain.apiKeyId !== apiKeyId) return domain;
      updated = { ...domain, status: "verified", verifiedAt: now, updatedAt: now };
      return updated;
    })
  }));
  return updated ? { domain: mapLocal(updated) } : { error: "Domain not found." };
}

export async function deleteDomain(apiKeyId, domainId) {
  if (isDatabaseConfigured()) {
    const result = await query("DELETE FROM custom_domains WHERE id = $1 AND api_key_id = $2 RETURNING id", [domainId, apiKeyId]);
    return result.rowCount > 0;
  }
  let removed = false;
  await updateStore(state => {
    const next = state.customDomains.filter(item => {
      const match = item.id === domainId && item.apiKeyId === apiKeyId;
      if (match) removed = true;
      return !match;
    });
    return { ...state, customDomains: next };
  });
  return removed;
}

export async function getPublicDomainDeployment(hostname) {
  const domain = normalizeDomain(hostname);
  if (!domain) return null;
  if (isDatabaseConfigured()) {
    const result = await query(
      `SELECT d.* FROM custom_domains cd
       JOIN deployments d ON d.id = cd.deployment_id
       WHERE cd.domain = $1 AND cd.status = 'verified' AND d.status = 'deployed'
       LIMIT 1`, [domain]
    );
    return result.rows[0] ? {
      id: result.rows[0].id, version: result.rows[0].version, apiKeyId: result.rows[0].api_key_id,
      projectId: result.rows[0].project_id, projectName: result.rows[0].project_name,
      slug: result.rows[0].slug, status: result.rows[0].status,
      files: result.rows[0].files || [], history: result.rows[0].history || [],
      createdAt: result.rows[0].created_at, updatedAt: result.rows[0].updated_at
    } : null;
  }
  const state = await readStore();
  const mapped = state.customDomains.find(item => item.domain === domain && item.status === "verified");
  if (!mapped) return null;
  const deployment = state.deployments.find(item => item.id === mapped.deploymentId && item.status === "deployed");
  return deployment || null;
}
