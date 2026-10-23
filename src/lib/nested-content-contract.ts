import { z } from "zod";
import { illustrationSchema } from "@/lib/learning-illustrations";
import type { BundleValidationError } from "@/lib/course-bundle";

const text = z.string();
const id = text.trim().min(1);
const strings = z.array(text);
const sourceRef = text.optional();
const withId = { id, sourceRef };

function addChoiceAnswerIssues(
  choices: string[],
  answer: string,
  addIssue: (path: (string | number)[], message: string) => void,
) {
  const normalizedChoices = choices.map((choice) => choice.trim());
  if (choices.length < 2) {
    addIssue(["choices"], "multiple-choice content needs at least two choices");
  }
  if (normalizedChoices.some((choice) => !choice)) {
    addIssue(["choices"], "multiple-choice choices cannot be blank");
  }
  const nonblankChoices = normalizedChoices.filter(Boolean);
  if (new Set(nonblankChoices).size !== nonblankChoices.length) {
    addIssue(["choices"], "multiple-choice choices must be distinct after trimming");
  }
  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) {
    addIssue(["answer"], "multiple-choice answer cannot be blank");
  } else if (!nonblankChoices.includes(normalizedAnswer)) {
    addIssue(["answer"], "multiple-choice answer must match one of its choices");
  }
}

const readingQuestion = z
  .object({ ...withId, q: text, choices: strings, answer: text })
  .superRefine((item, ctx) => {
    addChoiceAnswerIssues(item.choices, item.answer, (path, message) => {
      ctx.addIssue({ code: "custom", path, message });
    });
  });

const listeningItem = z
  .object({ ...withId, choices: strings, answer: text })
  .superRefine((item, ctx) => {
    addChoiceAnswerIssues(item.choices, item.answer, (path, message) => {
      ctx.addIssue({ code: "custom", path, message });
    });
  });

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
  listening: z.array(listeningItem),
  speaking: strings,
  reading: z.object({ title: text, text, translation: text, questions: z.array(readingQuestion), sourceRef }).nullish(),
  writing: z.object({ prompt: text, hint: text, targetWords: strings, sourceRef }).nullish(),
  dialogues: z.array(z.object({ ...withId, origin: z.enum(["source", "derived"]).optional(), translationOrigin: z.enum(["source", "derived"]).optional(), lines: z.array(dialogueLine) })).optional(),
  pronunciation: z.array(z.object({ ...withId, title: text, explanation: text, examples: strings })).optional(),
  culture: z.array(z.object({ ...withId, title: text, text })).optional(),
  extraSections: z.array(z.object({ ...withId, kind: text, title: text, content: strings })).optional(),
  media: z.array(z.object({
    ...withId, type: z.enum(["image", "video", "audio", "document"]),
    role: z.enum(["illustration", "diagram", "source-page", "external"]), src: text, alt: text,
  })).optional(),
  illustrations: z.array(illustrationSchema).optional(),
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
  const collections = ["vocabulary", "grammar", "listening", "dialogues", "pronunciation", "culture", "extraSections", "media", "illustrations"];
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
  if (result.success) for (const [index, image] of (result.data.illustrations ?? []).entries()) {
    const collection = image.kind === "vocabulary" ? result.data.vocabulary : image.kind === "grammar" ? result.data.grammar : image.kind === "dialogue" ? result.data.dialogues ?? [] : [];
    for (const targetId of image.targetIds) if (!collection.some(item => item.id === targetId)) errors.push({ path: `${prefix}.illustrations[${index}].targetIds`, reason: "Illustration target does not exist in this lesson", actual: targetId });
  }
  return errors;
}
