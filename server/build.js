import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const MAX_FILES = 100;
const MAX_FILE_CHARS = 200000;
const MAX_TOTAL_CHARS = 1000000;
const BUILD_TIMEOUT_MS = 120000;
const ALLOWED_BUILD_DEPENDENCIES = new Set(["react","react-dom","vite","@vitejs/plugin-react","@vitejs/plugin-react-swc","typescript","lucide-react"]);

function validateFiles(files) {
  const validFiles = files.filter(file =>
    file && typeof file.path === "string" && typeof file.content === "string" &&
    file.path && !file.path.startsWith("/") && !file.path.includes("..") &&
    file.content.length <= MAX_FILE_CHARS
  );
  if (validFiles.length !== files.length) {
    const error = new Error("Project contains invalid or oversized files");
    error.statusCode = 400;
    throw error;
  }
  if (!validFiles.some(file => file.path === "index.html")) {
    const error = new Error("Build requires index.html");
    error.statusCode = 400;
    throw error;
  }
  const totalCharacters = validFiles.reduce((sum, file) => sum + file.content.length, 0);
  if (validFiles.length > MAX_FILES || totalCharacters > MAX_TOTAL_CHARS) {
    const error = new Error("Build output exceeds project limits");
    error.statusCode = 413;
    throw error;
  }
  return { validFiles, totalCharacters };
}
function readPackageJson(files) {
  const packageFile = files.find(file => file.path === "package.json");
  if (!packageFile) return null;
  try {
    return JSON.parse(packageFile.content);
  } catch {
    const error = new Error("Invalid package.json");
    error.statusCode = 400;
    throw error;
  }
}
function validateViteProject(packageJson) {
  if (packageJson?.scripts?.build !== "vite build") {
    const error = new Error("Vite projects must use the exact build script: vite build");
    error.statusCode = 400;
    throw error;
  }
  const dependencies = {...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {})};
  for (const name of Object.keys(dependencies)) {
    if (!ALLOWED_BUILD_DEPENDENCIES.has(name)) {
      const error = new Error(`Build dependency is not allowed: ${name}`);
      error.statusCode = 400;
      throw error;
    }
  }
}
async function runViteBuild(files) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "4ndev-build-"));
  const projectRoot = path.join(tempRoot, "project");
  try {
    fs.mkdirSync(projectRoot, { recursive: true });
    for (const file of files) {
      const target = path.join(projectRoot, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content, "utf8");
    }
    await execFileAsync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: projectRoot, timeout: BUILD_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    await execFileAsync("npm", ["run", "build", "--", "--base", "./"], {
      cwd: projectRoot, timeout: BUILD_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024
    });
    const distRoot = path.join(projectRoot, "dist");
    if (!fs.existsSync(path.join(distRoot, "index.html"))) {
      const error = new Error("Vite build completed without dist/index.html");
      error.statusCode = 422;
      throw error;
    }
    const outputFiles = [];
    let totalCharacters = 0;
    function collect(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        const relative = path.relative(distRoot, absolute).split(path.sep).join("/");
        if (entry.isDirectory()) { collect(absolute); continue; }
        const content = fs.readFileSync(absolute);
        if (content.length > MAX_FILE_CHARS) {
          const error = new Error("Build output contains an oversized file");
          error.statusCode = 413;
          throw error;
        }
        const isText = !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i.test(relative);
        outputFiles.push({
          path: relative,
          content: isText ? content.toString("utf8") : content.toString("base64"),
          encoding: isText ? "utf8" : "base64"
        });
        totalCharacters += content.length;
      }
    }
    collect(distRoot);
    if (outputFiles.length > MAX_FILES || totalCharacters > MAX_TOTAL_CHARS) {
      const error = new Error("Build output exceeds project limits");
      error.statusCode = 413;
      throw error;
    }
    return { type: "vite", status: "built", entrypoint: "index.html", files: outputFiles, fileCount: outputFiles.length, totalCharacters };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
export async function buildProject(apiKeyId, project, files) {
  const { validFiles, totalCharacters } = validateFiles(files);
  const packageJson = readPackageJson(validFiles);
  let result = {
    type: "static", status: "built", entrypoint: "index.html",
    files: validFiles.map(file => ({path: file.path, content: file.content, encoding: "utf8"})),
    fileCount: validFiles.length, totalCharacters
  };
  if (packageJson) {
    validateViteProject(packageJson);
    result = await runViteBuild(validFiles);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const { query, isDatabaseConfigured } = await import("./db.js");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for build storage");
  }

  await query(
    `INSERT INTO builds
      (id, api_key_id, project_id, project_name, type, status, entrypoint, files, file_count, total_characters, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $11)`,
    [
      id, apiKeyId, project.id, project.name, result.type, result.status,
      result.entrypoint, JSON.stringify(result.files), result.fileCount,
      result.totalCharacters, now
    ]
  );

  return {
    id,
    apiKeyId,
    projectId: project.id,
    projectName: project.name,
    ...result,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

export async function getBuild(apiKeyId, buildId) {
  if (!(await import("./db.js")).isDatabaseConfigured()) return null;
  const { query } = await import("./db.js");
  const result = await query(
    `SELECT id, api_key_id, project_id, project_name, type, status, entrypoint,
            files, file_count, total_characters, created_at, updated_at
     FROM builds
     WHERE id = $1 AND api_key_id = $2
     LIMIT 1`,
    [buildId, apiKeyId]
  );
  return result.rows[0] ? mapBuildRow(result.rows[0]) : null;
}

export async function listBuilds(apiKeyId, projectId = null) {
  const { query, isDatabaseConfigured } = await import("./db.js");
  if (!isDatabaseConfigured()) return [];

  const params = [apiKeyId];
  let sql = `SELECT id, api_key_id, project_id, project_name, type, status, entrypoint,
                     files, file_count, total_characters, created_at, updated_at
              FROM builds WHERE api_key_id = $1`;
  if (projectId) {
    params.push(projectId);
    sql += " AND project_id = $2";
  }
  sql += " ORDER BY created_at DESC";

  const result = await query(sql, params);
  return result.rows.map(mapBuildRow).map(({ files, ...build }) => build);
}

function mapBuildRow(row) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    projectId: row.project_id,
    projectName: row.project_name,
    type: row.type,
    status: row.status,
    entrypoint: row.entrypoint,
    files: row.files,
    fileCount: row.file_count,
    totalCharacters: row.total_characters,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}
