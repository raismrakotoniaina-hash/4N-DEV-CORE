const OPENAI_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

export async function generateChatResponse(input) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || "OpenAI request failed"
    );
    error.statusCode = response.status;
    throw error;
  }

  return {
    id: data.id,
    model: data.model,
    text: data.output_text || "",
    usage: data.usage || null
  };
}
