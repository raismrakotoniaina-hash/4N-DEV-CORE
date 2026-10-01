const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const AI_PROVIDER = (process.env.AI_PROVIDER || "auto").toLowerCase();

function useDemoProvider() {
  return AI_PROVIDER === "demo" || (AI_PROVIDER === "auto" && !process.env.OPENAI_API_KEY);
}

function demoInputText(input) {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function demoId(prefix) {
  return `demo_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function demoChatResponse(input) {
  const text = demoInputText(input).trim();
  return {
    id: demoId("chat"),
    model: "4n-dev-demo-chat",
    text: text
      ? `[4N DEV Demo AI] Voaray ny fangatahanao: "${text.slice(0, 240)}". Ny Demo Provider dia ampiasaina satria mbola tsy misy OPENAI_API_KEY. Rehefa vonona ny OpenAI billing dia azo avadika ho provider tena izy.`
      : "[4N DEV Demo AI] Vonona handray ny fangatahanao.",
    usage: { provider: "demo", input_characters: text.length }
  };
}

function demoCodingResponse(input) {
  const text = demoInputText(input).trim();
  return {
    id: demoId("coding"),
    model: "4n-dev-demo-coding",
    text: `[4N DEV Demo Coding] Voaray ny fangatahana coding: "${text.slice(0, 240)}". Ity dia test response ihany; tsy mbola mampiasa modely ivelany ny Demo Provider.`,
    usage: { provider: "demo", input_characters: text.length }
  };
}

function demoEmbedding(input) {
  const text = demoInputText(input);
  const items = Array.isArray(input) ? input : [input];
  const vectors = items.map((item) => {
    const source = demoInputText(item);
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Array.from({ length: 8 }, (_, index) => {
      const value = Math.sin((hash >>> 0) + index * 9973);
      return Number(value.toFixed(6));
    });
  });

  return {
    model: "4n-dev-demo-embedding",
    embeddings: vectors.map((embedding, index) => ({
      object: "embedding",
      index,
      embedding
    })),
    usage: { provider: "demo", input_characters: text.length }
  };
}

function demoImage(prompt, quality) {
  const safePrompt = String(prompt).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#10162a"/><circle cx="512" cy="430" r="230" fill="#6d5dfc" opacity=".75"/><circle cx="650" cy="600" r="180" fill="#4db6ff" opacity=".55"/><text x="512" y="850" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="34">4N DEV Demo Image</text><text x="512" y="900" text-anchor="middle" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="20">${safePrompt.slice(0, 70)}</text><text x="512" y="940" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="18">quality: ${quality}</text></svg>`;
  const encoded = Buffer.from(svg).toString("base64");

  return {
    model: "4n-dev-demo-image",
    image: { type: "url", url: `data:image/svg+xml;base64,${encoded}` }
  };
}

function demoBuilderPlan(prompt) {
  const text = String(prompt || "").trim();
  const lower = text.toLowerCase();

  let type = "website";
  if (/e-?commerce|boutique|shop|store|cart|checkout/.test(lower)) type = "ecommerce";
  else if (/dashboard|admin|back-office|analytics/.test(lower)) type = "dashboard";
  else if (/booking|reservation|rendez-vous|appointment/.test(lower)) type = "booking";
  else if (/invoice|facture|billing|business|crm|client/.test(lower)) type = "business";
  else if (/chat|messagerie|conversation/.test(lower)) type = "chat";
  else if (/education|cours|formation|school|école|learning/.test(lower)) type = "education";
  else if (/crud|inventory|stock|pos|caisse/.test(lower)) type = "crud";
  else if (/mobile|pwa|progressive web app/.test(lower)) type = "mobile";

  const pagesByType = {
    website: ["Home", "About", "Contact"],
    ecommerce: ["Home", "Products", "Product Detail", "Cart", "Checkout"],
    dashboard: ["Dashboard", "Analytics", "Settings"],
    booking: ["Home", "Services", "Booking", "Confirmation"],
    business: ["Dashboard", "Clients", "Invoices", "Settings"],
    chat: ["Inbox", "Conversation", "Profile"],
    education: ["Home", "Courses", "Course Detail", "Profile"],
    crud: ["Dashboard", "List", "Create/Edit", "Settings"],
    mobile: ["Home", "Explore", "Detail", "Profile"]
  };

  return {
    model: "4n-dev-demo-planner",
    plan: {
      project_type: type,
      goal: text.slice(0, 500),
      stack: ["HTML", "CSS", "JavaScript"],
      pages: pagesByType[type] || pagesByType.website,
      features: ["Responsive UI", "Navigation", "Reusable components", "Form validation"],
      data_models: type === "ecommerce" ? ["Product", "Cart", "Order"] :
        type === "booking" ? ["User", "Service", "Booking"] :
        type === "business" ? ["Client", "Invoice", "Activity"] :
        type === "crud" ? ["Record", "User"] :
        type === "mobile" ? ["User", "Item", "Preference"] : ["User"],
      files: ["index.html", "styles.css", "app.js"],
      next_step: "Send this plan to the Builder generator for implementation."
    },
    usage: { provider: "demo", input_characters: text.length }
  };
}

export async function generateBuilderPlan({ prompt }) {
  if (useDemoProvider()) return demoBuilderPlan(prompt);

  const instructions = `You are the 4N DEV AI Builder Planner.
Turn the user's app request into a precise implementation plan.
Return ONLY valid JSON with this exact shape:
{
  "project_type": "website|ecommerce|dashboard|booking|business|chat|education|crud|other",
  "goal": "short goal",
  "stack": ["..."],
  "pages": ["..."],
  "features": ["..."],
  "data_models": ["..."],
  "files": ["..."],
  "next_step": "..."
}
Rules:
- Infer the application type from the request.
- Choose a practical stack appropriate to the request.
- List concrete pages, features, data models, and expected files.
- Do not write file contents yet.
- Do not include markdown fences or text outside JSON.
User request:
${prompt}`;

  const data = await openAIRequest(OPENAI_RESPONSES_URL, {
    model: DEFAULT_MODEL,
    input: [{ role: "user", content: [{ type: "input_text", text: instructions }] }],
    max_output_tokens: 3000
  });

  let plan;
  try {
    plan = JSON.parse(data.output_text || "{}");
  } catch {
    const error = new Error("Builder Planner returned invalid JSON");
    error.statusCode = 502;
    throw error;
  }

  return {
    model: data.model,
    plan,
    usage: data.usage || null
  };
}

function demoBuilderResponse({ prompt, project = null, plan = null }) {
  const name = "4N DEV Demo Project";
  const description = "Demo Builder project generated without an external AI provider.";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>4N DEV Demo</title>
  <style>body{font-family:Arial,sans-serif;max-width:760px;margin:60px auto;padding:24px;line-height:1.6}code{background:#eef2ff;padding:3px 6px;border-radius:6px}</style>
</head>
<body>
  <h1>4N DEV Demo Project</h1>
  <p>This project was generated by the local Demo AI provider.</p>
  <p>Request: <code>${String(prompt).replace(/[<>&]/g, "")}</code></p>
</body>
</html>`;

  return {
    id: demoId("builder"),
    model: "4n-dev-demo-builder",
    name,
    description,
    summary: plan
      ? `Demo Builder generated from ${plan.project_type || "the provided"} planner output.`
      : project
        ? "Demo Builder test completed using the existing project context."
        : "Demo Builder test completed without an external AI provider.",
    files: [{ path: "index.html", content: html }],
    usage: { provider: "demo" }
  };
}

function requireOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.statusCode = 503;
    throw error;
  }
}

async function openAIRequest(url, body) {
  requireOpenAIKey();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "OpenAI request failed");
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

export async function generateChatResponse(input) {
  if (useDemoProvider()) return demoChatResponse(input);

  const data = await openAIRequest(OPENAI_RESPONSES_URL, { model: DEFAULT_MODEL, input });
  return { id: data.id, model: data.model, text: data.output_text || "", usage: data.usage || null };
}

export async function generateCodingResponse(input) {
  if (useDemoProvider()) return demoCodingResponse(input);

  const codingInput = [
    {
      role: "developer",
      content: [{ type: "input_text", text: "You are the 4N DEV coding assistant. Give practical, correct code and explain important implementation details." }]
    },
    {
      role: "user",
      content: [{ type: "input_text", text: typeof input === "string" ? input : JSON.stringify(input) }]
    }
  ];

  const data = await openAIRequest(OPENAI_RESPONSES_URL, {
    model: DEFAULT_MODEL,
    input: codingInput,
    max_output_tokens: 3000
  });

  return { id: data.id, model: data.model, text: data.output_text || "", usage: data.usage || null };
}

export async function generateEmbedding(input) {
  if (useDemoProvider()) return demoEmbedding(input);

  const data = await openAIRequest(OPENAI_EMBEDDINGS_URL, {
    model: EMBEDDING_MODEL,
    input
  });

  return {
    model: data.model || EMBEDDING_MODEL,
    embeddings: data.data || [],
    usage: data.usage || null
  };
}


function demoBuilderRepair({ files, review }) {
  const repaired = files.map(file => {
    if (/\.html$/i.test(file.path)) {
      let content = file.content;
      if (!/<html[\\s>]/i.test(content)) {
        content = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${content}</body></html>`;
      } else if (!/<meta[^>]+viewport/i.test(content)) {
        content = content.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
      }
      return { ...file, content };
    }
    return file;
  });
  return {
    model: "4n-dev-demo-builder-repair",
    files: repaired,
    summary: `Demo repair attempted for ${review.issues.length} issue(s).`,
    usage: { provider: "demo", repair: true }
  };
}

export async function repairBuilderFiles({ prompt, plan = null, files, review }) {
  if (useDemoProvider()) return demoBuilderRepair({ files, review });

  const repairInput = {
    prompt,
    plan,
    review,
    files
  };

  const instructions = `You are the 4N DEV AI Builder Repair engine.
Repair ONLY the issues identified by the quality review.
Preserve existing functionality, design, file paths, and working code.
Return ONLY valid JSON:
{
  "summary": "short repair summary",
  "files": [
    { "path": "relative/path.ext", "content": "complete file content" }
  ]
}
Rules:
- Return the complete repaired file set, not patches.
- Keep all paths relative and safe.
- Never add secrets, API keys, credentials, or private environment values.
- Fix the listed review issues and do not unnecessarily rewrite unrelated files.
- The repaired output must be runnable.
- Do not use markdown fences or text outside JSON.
Repair request:
${JSON.stringify(repairInput)}`;

  const data = await openAIRequest(OPENAI_RESPONSES_URL, {
    model: DEFAULT_MODEL,
    input: [{ role: "user", content: [{ type: "input_text", text: instructions }] }],
    max_output_tokens: 16000
  });

  let parsed;
  try {
    parsed = JSON.parse(data.output_text || "{}");
  } catch {
    const error = new Error("Builder repair returned invalid JSON");
    error.statusCode = 502;
    throw error;
  }

  return {
    model: data.model,
    files: parsed.files || [],
    summary: parsed.summary || "Builder repair completed.",
    usage: data.usage || null
  };
}


export async function repairBuilderFiles({ prompt, plan = null, files, review }) {
  if (useDemoProvider()) {
    return {
      model: "4n-dev-demo-builder-repair",
      files: files.map((file) => {
        if (!/\.html$/i.test(file.path)) return file;
        let content = file.content;
        if (!/<html[\s>]/i.test(content)) {
          content = "<!doctype html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body>" + content + "</body></html>";
        } else if (!/<meta[^>]+viewport/i.test(content)) {
          content = content.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1">');
        }
        return { ...file, content };
      }),
      summary: "Demo repair completed.",
      usage: { provider: "demo", repair: true }
    };
  }

  const instructions = `Repair only the issues identified by this Builder review.
Preserve working functionality and existing file paths.
Return ONLY valid JSON with: {"summary":"...","files":[{"path":"...","content":"..."}]}.
Never add secrets, API keys, credentials, or private environment values.
User request: ${prompt}
Plan: ${JSON.stringify(plan)}
Review: ${JSON.stringify(review)}
Files: ${JSON.stringify(files)}`;

  const data = await openAIRequest(OPENAI_RESPONSES_URL, {
    model: DEFAULT_MODEL,
    input: [{ role: "user", content: [{ type: "input_text", text: instructions }] }],
    max_output_tokens: 16000
  });

  let parsed;
  try {
    parsed = JSON.parse(data.output_text || "{}");
  } catch {
    const error = new Error("Builder repair returned invalid JSON");
    error.statusCode = 502;
    throw error;
  }

  return {
    model: data.model,
    files: parsed.files || [],
    summary: parsed.summary || "Builder repair completed.",
    usage: data.usage || null
  };
}

export async function generateBuilderResponse({ prompt, project = null, plan = null }) {
  if (useDemoProvider()) return demoBuilderResponse({ prompt, project, plan });

  const instructions = `You are the 4N DEV AI Builder engine.
Generate a small, runnable web project from the user's request.
Return ONLY valid JSON with this exact shape:
{
  "name": "Project name",
  "description": "Short description",
  "summary": "What was generated",
  "files": [
    { "path": "index.html", "content": "..." }
  ]
}
Rules:
- Generate complete file contents, not placeholders.
- Use relative paths only.
- Prefer a simple static HTML/CSS/JS project unless the user explicitly asks for another stack.
- Keep the project focused and runnable.
- Do not include markdown fences or any text outside the JSON.
User request:
${prompt}
Existing project:
${project ? JSON.stringify(project) : "none"}`;

  const data = await openAIRequest(OPENAI_RESPONSES_URL, {
    model: DEFAULT_MODEL,
    input: [{ role: "user", content: [{ type: "input_text", text: instructions }] }],
    max_output_tokens: 16000
  });

  let parsed;
  try {
    parsed = JSON.parse(data.output_text || "{}");
  } catch {
    const error = new Error("Builder returned invalid JSON");
    error.statusCode = 502;
    throw error;
  }

  return {
    id: data.id,
    model: data.model,
    name: parsed.name || "AI Builder Project",
    description: parsed.description || "",
    summary: parsed.summary || "",
    files: parsed.files || [],
    usage: data.usage || null
  };
}

export async function generateImage(prompt, quality) {
  if (useDemoProvider()) return demoImage(prompt, quality);

  const data = await openAIRequest(OPENAI_IMAGES_URL, { model: IMAGE_MODEL, prompt, quality });
  const imageData = data?.data?.[0];

  return {
    model: data.model || IMAGE_MODEL,
    image: imageData?.b64_json
      ? { type: "base64", data: imageData.b64_json }
      : imageData?.url
        ? { type: "url", url: imageData.url }
        : null
  };
}
