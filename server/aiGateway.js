const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

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
  const data = await openAIRequest(OPENAI_RESPONSES_URL, { model: DEFAULT_MODEL, input });
  return { id: data.id, model: data.model, text: data.output_text || "", usage: data.usage || null };
}

export async function generateCodingResponse(input) {
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

export async function generateBuilderResponse({ prompt, project = null }) {
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
    max_output_tokens: 8000
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
