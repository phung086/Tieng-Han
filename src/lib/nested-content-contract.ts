import { z } from "zod";
import type { BundleValidationError } from "@/lib/course-bundle";

const text = z.string();
const id = text.trim().min(1);
const strings = z.array(text);
const sourceRef = text.optional();
const withId = { id, sourceRef };
const readingQuestion = z.object({ ...withId, q: text, choices: strings, answer: text });
const dialogueLine = z.object({
  speaker: text.optional(), targetText: text.optional(), ko: text.optional(),
  learnerMeaning: text.optional(), vi: text.optional(), sourceRef,
}).superRefine((line, ctx) => {
  if (!(line.targetText || line.ko)?.trim()) ctx.addIssue({ code: "custom", path: ["targetText"], message: "targetText or ko is required" });
});

// This validates fields consumed by the UI before alias normalization can hide
// malformed input. Unknown extension fields remain on the original bundle.
const nestedLessonSchema = z.object({
  vocabulary: z.array(z.object({ ...withId, example: text.optional() })),
  grammar: z.array(z.object({ ...withId, examples: strings })),
  listening: z.array(z.object({ ...withId, choices: strings, answer: text })),
  speaking: strings,
  reading: z.object({ title: text, text, translation: text, questions: z.array(readingQuestion), sourceRef }).nullish(),
  writing: z.object({ prompt: text, hint: text, targetWords: strings, sourceRef }).nullish(),
  dialogues: z.array(z.object({ ...withId, lines: z.array(dialogueLine) })).optional(),
  pronunciation: z.array(z.object({ ...withId, title: text, explanation: text, examples: strings })).optional(),
  culture: z.array(z.object({ ...withId, title: text, text })).optional(),
  extraSections: z.array(z.object({ ...withId, kind: text, title: text, content: strings })).optional(),
  media: z.array(z.object({
    ...withId, type: z.enum(["image", "video", "audio", "document"]),
    role: z.enum(["illustration", "diagram", "source-page", "external"]), src: text, alt: text,
  })).optional(),
  quality: z.object({
    coverageScore: z.number().min(0).max(100), groundingScore: z.number().min(0).max(100),
    issues: strings, missingTopics: strings,
  }).optional(),
  sourceRef,
});

export function contentPath(prefix: string, parts: PropertyKey[]) {
  return prefix + parts.map(part => typeof part === "number" ? `[${part}]` : `.${String(part)}`).join("");
}

function actualAt(value: unknown, parts: PropertyKey[]): unknown {
  let actual = value;
  for (const part of parts) actual = actual && typeof actual === "object" ? (actual as Record<PropertyKey, unknown>)[part] : undefined;
  // Describe types only; do not echo full textbook content into diagnostics.
  return actual === null ? "null" : Array.isArray(actual) ? "array" : typeof actual;
}

export function validateNestedContent(value: unknown, prefix: string): BundleValidationError[] {
  const result = nestedLessonSchema.safeParse(value);
  const errors: BundleValidationError[] = result.success ? [] : result.error.issues.map(issue => ({
    path: contentPath(prefix, issue.path), reason: issue.message,
    expected: "expected" in issue ? String(issue.expected) : undefined,
    actual: actualAt(value, issue.path),
  }));
  if (!value || typeof value !== "object") return errors;
  const row = value as Record<string, unknown>;
  const collections = ["vocabulary", "grammar", "listening", "dialogues", "pronunciation", "culture", "extraSections", "media"];
  for (const key of collections) {
    if (!Array.isArray(row[key])) continue;
    const seen = new Set<string>();
    (row[key] as unknown[]).forEach((item, index) => {
      const itemId = (item as { id?: unknown } | null)?.id;
      if (typeof itemId !== "string") return;
      if (seen.has(itemId)) errors.push({ path: `${prefix}.${key}[${index}].id`, reason: "duplicate id", expected: "unique item id", actual: itemId });
      seen.add(itemId);
    });
  }
  return errors;
}
