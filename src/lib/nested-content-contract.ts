import { z } from "zod";
import { illustrationSchema } from "@/lib/learning-illustrations";
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

const sourceExerciseItem = z.object({
  id,
  contentIndex: z.number().int().nonnegative(),
  type: z.enum(["choice", "fill-blank", "reorder", "matching", "translation", "role-play", "extended-writing", "manual"]),
  choices: strings.optional(),
  tokens: strings.optional(),
  leftItems: strings.optional(),
  rightItems: strings.optional(),
  answerPairs: z.array(z.object({ left: text, right: text })).optional(),
  answer: text.optional(),
  hint: text.optional(),
});

// This validates fields consumed by the UI before alias normalization can hide
// malformed input. Unknown extension fields remain on the original bundle.
const nestedLessonSchema = z.object({
  vocabulary: z.array(z.object({ ...withId, example: text.optional(), exampleSourceRef: sourceRef })),
  grammar: z.array(z.object({ ...withId, examples: strings, exampleSourceRefs: strings.optional() })),
  listening: z.array(z.object({ ...withId, choices: strings, answer: text })),
  speaking: strings,
  speakingSourceRefs: strings.optional(),
  reading: z.object({ title: text, text, translation: text, questions: z.array(readingQuestion), sourceRef }).nullish(),
  writing: z.object({ prompt: text, hint: text, targetWords: strings, targetWordSourceRefs: strings.optional(), sourceRef }).nullish(),
  dialogues: z.array(z.object({ ...withId, origin: z.enum(["source", "derived"]).optional(), translationOrigin: z.enum(["source", "derived"]).optional(), lines: z.array(dialogueLine) })).optional(),
  pronunciation: z.array(z.object({ ...withId, title: text, explanation: text, examples: strings, exampleSourceRefs: strings.optional() })).optional(),
  culture: z.array(z.object({ ...withId, title: text, text })).optional(),
  extraSections: z.array(z.object({
    ...withId, kind: text, title: text, content: strings, contentSourceRefs: strings.optional(),
    contentExerciseItems: z.array(sourceExerciseItem).optional(),
  })).optional(),
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
  if (Array.isArray(row.extraSections)) {
    row.extraSections.forEach((rawSection, sectionIndex) => {
      if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) return;
      const section = rawSection as Record<string, unknown>;
      if (!Array.isArray(section.contentExerciseItems)) return;
      const contentLength = Array.isArray(section.content) ? section.content.length : 0;
      const seenIds = new Set<string>();
      const seenIndexes = new Set<number>();
      section.contentExerciseItems.forEach((rawActivity, activityIndex) => {
        if (!rawActivity || typeof rawActivity !== "object" || Array.isArray(rawActivity)) return;
        const activity = rawActivity as Record<string, unknown>;
        if (typeof activity.id === "string") {
          if (seenIds.has(activity.id)) errors.push({
            path: `${prefix}.extraSections[${sectionIndex}].contentExerciseItems[${activityIndex}].id`,
            reason: "duplicate source exercise metadata id", expected: "unique id within section", actual: activity.id,
          });
          seenIds.add(activity.id);
        }
        const contentIndex = activity.contentIndex;
        if (typeof contentIndex !== "number" || !Number.isSafeInteger(contentIndex) || contentIndex < 0 || contentIndex >= contentLength) {
          errors.push({
            path: `${prefix}.extraSections[${sectionIndex}].contentExerciseItems[${activityIndex}].contentIndex`,
            reason: "must point to an existing verbatim content entry", expected: `0..${Math.max(0, contentLength - 1)}`, actual: contentIndex,
          });
        } else if (seenIndexes.has(contentIndex)) {
          errors.push({
            path: `${prefix}.extraSections[${sectionIndex}].contentExerciseItems[${activityIndex}].contentIndex`,
            reason: "multiple exercise motifs point to the same content entry", expected: "one motif per content entry", actual: contentIndex,
          });
        } else {
          seenIndexes.add(contentIndex);
        }
      });
    });
  }
  if (result.success) for (const [index, image] of (result.data.illustrations ?? []).entries()) {
    const collection = image.kind === "vocabulary" ? result.data.vocabulary : image.kind === "grammar" ? result.data.grammar : image.kind === "dialogue" ? result.data.dialogues ?? [] : [];
    for (const targetId of image.targetIds) if (!collection.some(item => item.id === targetId)) errors.push({ path: `${prefix}.illustrations[${index}].targetIds`, reason: "Illustration target does not exist in this lesson", actual: targetId });
  }
  return errors;
}
