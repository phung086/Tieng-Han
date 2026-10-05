type ResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

function responseText(payload: ResponsePayload) {
  if (payload.output_text) return payload.output_text;

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" || typeof item.text === "string")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
}

function parseJsonText(text: string) {
  const stripped = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstObject = stripped.indexOf("{");
  const lastObject = stripped.lastIndexOf("}");

  if (firstObject < 0 || lastObject <= firstObject) {
    throw new Error("AI did not return a JSON object.");
  }

  return JSON.parse(stripped.slice(firstObject, lastObject + 1)) as unknown;
}

export async function callContentModel(instructions: string, input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY chưa được cấu hình trong .env.local.");
  }

  const model = process.env.OPENAI_CONTENT_MODEL || "gpt-6-luna";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as ResponsePayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "Không thể gọi AI content service.");
  }

  return parseJsonText(responseText(payload));
}
