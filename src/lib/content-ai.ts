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

type InputContent = {
  type: "input_text" | "input_image";
  text?: string;
  image_url?: string;
  detail?: "low" | "high" | "auto";
};

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 110_000;

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

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shouldRetry(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function requestResponse(
  instructions: string,
  userContent: string | InputContent[],
  modelOverride?: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY chưa được cấu hình trong .env.local.");
  }

  const model =
    modelOverride ||
    process.env.OPENAI_CONTENT_MODEL ||
    "gpt-6-luna";

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
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
            { role: "user", content: userContent },
          ],
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      let payload: ResponsePayload = {};
      try {
        payload = (await response.json()) as ResponsePayload;
      } catch {
        payload = {};
      }

      if (response.ok) {
        return parseJsonText(responseText(payload));
      }

      const message =
        payload.error?.message ||
        "AI content service trả về HTTP " + response.status + ".";

      lastError = new Error(message);

      if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS) {
        throw lastError;
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error
          : new Error("Không thể gọi AI content service.");

      lastError =
        reason.name === "AbortError"
          ? new Error("AI request quá thời gian cho phép.")
          : reason;

      if (attempt === MAX_ATTEMPTS) throw lastError;
    } finally {
      clearTimeout(timeout);
    }

    await wait(700 * Math.pow(2, attempt - 1));
  }

  throw lastError ?? new Error("Không thể gọi AI content service.");
}

export async function callContentModel(instructions: string, input: string) {
  return requestResponse(instructions, input);
}

export async function callVisionContentModel(
  instructions: string,
  content: InputContent[],
) {
  return requestResponse(
    instructions,
    content,
    process.env.OPENAI_OCR_MODEL ||
      process.env.OPENAI_CONTENT_MODEL ||
      "gpt-6-luna",
  );
}
