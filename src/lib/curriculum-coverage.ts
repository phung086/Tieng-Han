import { z } from "zod";
import type { LessonContent } from "@/data/content";
import type { CompiledCourseBundle } from "@/lib/course-bundle";

const nonempty = z.string().trim().min(1);
export const CURRICULUM_AUDIT_VERSION = 4;
export const sourceInventorySchema = z.object({
  version: z.literal(1),
  pages: z.array(z.object({
    fileName: nonempty, pageNumber: z.number().int().positive(),
    status: z.enum(["reviewed", "unavailable"]), reason: nonempty.optional(),
    classification: z.enum(["learning-content", "non-learning"]).optional(),
  })),
  items: z.array(z.object({
    id: nonempty, lessonId: z.number().int().positive(), kind: nonempty,
    fileName: nonempty, pageNumber: z.number().int().positive(), sourceRef: nonempty,
    // JSON pointer relative to the lesson, e.g. /vocabulary/0 or /grammar/0/examples/1.
    contentPointer: nonempty,
    practiceMethod: z.enum(["questions", "workbook"]),
    // Canonical supported quiz motif required for at least one linked question when specified.
    motif: z.enum(["choice", "input", "reorder"]).optional(),
    practiceQuestionIds: z.array(nonempty).default([]), verified: z.boolean(),
  })),
});
export type SourceInventory = z.infer<typeof sourceInventorySchema>;
export type CoverageRatio = { covered: number; total: number; percent: number | null };
export type CurriculumCoverage = {
  auditVersion?: number;
  status: "unverified" | "partial" | "blocked" | "complete";
  basis: string;
  sourceCoverage: CoverageRatio;
  practiceCoverage: CoverageRatio;
  validationCoverage: CoverageRatio;
  derivedContent: number;
  issues: string[];
};
export function isCurrentCompleteCoverage(coverage: CurriculumCoverage | undefined) {
  return coverage?.auditVersion === CURRICULUM_AUDIT_VERSION && coverage.status === "complete";
}
const ratio = (covered: number, total: number): CoverageRatio => ({ covered, total, percent: total ? covered / total * 100 : null });

function resolvePointer(root: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let value = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (["__proto__", "constructor", "prototype"].includes(key) || !value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
const sourceKey = (fileName: string, pageNumber: number) => JSON.stringify([fileName, pageNumber]);

function decodedPointerParts(pointer: string): string[] {
  if (!pointer.startsWith("/")) return [];
  return pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function indexedPart(value: string | undefined): number {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : -1;
}

/** Resolve evidence for the exact item named by contentPointer. A parent
 * section's sourceRef is never reused for a nested string-array item. */
function sourceRefAtPointer(lesson: LessonContent, pointer: string, resolved: unknown): string | undefined {
  if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
    const ref = (resolved as { sourceRef?: unknown }).sourceRef;
    if (typeof ref === "string" && ref.trim()) return ref.trim();
  }
  const parts = decodedPointerParts(pointer);
  const root = parts[0];
  const index = indexedPart(parts[1]);
  const child = parts[2];
  const childIndex = indexedPart(parts[3]);
  if (root === "writing" && parts[1] === "targetWords" && parts.length === 3) {
    const targetIndex = indexedPart(parts[2]);
    return targetIndex >= 0 ? lesson.writing?.targetWordSourceRefs?.[targetIndex]?.trim() || undefined : undefined;
  }
  if (index < 0) return undefined;
  if (root === "speaking" && parts.length === 2) return lesson.speakingSourceRefs?.[index]?.trim() || undefined;
  if (root === "vocabulary" && child === "example" && parts.length === 3) return lesson.vocabulary[index]?.exampleSourceRef?.trim() || undefined;
  if (root === "grammar" && child === "examples" && parts.length === 4) return lesson.grammar[index]?.exampleSourceRefs?.[childIndex]?.trim() || undefined;
  if (root === "pronunciation" && child === "examples" && parts.length === 4) return lesson.pronunciation?.[index]?.exampleSourceRefs?.[childIndex]?.trim() || undefined;
  if (root === "extraSections" && child === "content" && parts.length === 4) return lesson.extraSections?.[index]?.contentSourceRefs?.[childIndex]?.trim() || undefined;
  return undefined;
}

/** Structural reconciliation against a submitted, independently reviewed source
 * inventory. It does not pretend that schema validation reads the PDF itself.
 */
export function auditCurriculumCoverage(bundle: CompiledCourseBundle): CurriculumCoverage {
  const derivedContent = bundle.course.questions.filter(question => question.origin === "derived").length;
  const empty = { auditVersion: CURRICULUM_AUDIT_VERSION, sourceCoverage: ratio(0, 0), practiceCoverage: ratio(0, 0), validationCoverage: ratio(0, 0), derivedContent };
  if (!bundle.sourceInventory) return { ...empty, status: "unverified", basis: "No independent source inventory", issues: ["Chưa có kiểm kê nguồn được đối chiếu độc lập."] };
  const inventory = sourceInventorySchema.parse(bundle.sourceInventory);
  const issues: string[] = [];
  const expectedPages = new Set<string>();
  for (const source of bundle.sourceManifest ?? []) {
    for (let page = 1; page <= source.pageCount; page++) expectedPages.add(sourceKey(source.name, page));
  }
  if (!expectedPages.size) issues.push("Thiếu sourceManifest để xác minh phạm vi tài liệu.");
  const reviewedPages = new Set<string>();
  const seenPages = new Set<string>();
  for (const page of inventory.pages) {
    const key = sourceKey(page.fileName, page.pageNumber);
    if (seenPages.has(key)) issues.push("Trùng trang kiểm kê: " + key);
    seenPages.add(key);
    if (!expectedPages.has(key)) issues.push("Trang ngoài nguồn: " + key);
    if (page.status === "reviewed") reviewedPages.add(key);
    else issues.push("Trang bất khả dụng: " + key + ": " + (page.reason ?? "chưa ghi lý do"));
  }
  for (const key of expectedPages) if (!reviewedPages.has(key)) issues.push("Trang chưa được đối chiếu: " + key);
  for (const page of inventory.pages) {
    if (page.status !== "reviewed") continue;
    const key = sourceKey(page.fileName, page.pageNumber);
    const pageItems = inventory.items.filter(item => item.fileName === page.fileName && item.pageNumber === page.pageNumber);
    if (page.classification === "non-learning") {
      if (!page.reason || pageItems.length) issues.push("Trang loại khỏi nội dung học phải có lý do và không có item: " + key);
    } else if (page.classification !== "learning-content" || !pageItems.length) {
      issues.push("Trang chưa có kiểm kê đơn vị nội dung (không được chỉ đánh dấu đã đọc): " + key);
    }
  }
  for (const lesson of bundle.course.lessons) {
    const aligned = (refs: string[] | undefined, count: number, path: string) => {
      if (refs && (refs.length !== count || refs.some(ref => !ref.trim()))) {
        issues.push("Mảng tham chiếu item không khớp nội dung tại " + path);
      }
    };
    aligned(lesson.speakingSourceRefs, lesson.speaking.length, "lesson " + lesson.id + ".speaking");
    lesson.vocabulary.forEach((item, index) => {
      if (item.exampleSourceRef !== undefined && !item.exampleSourceRef.trim()) issues.push("Tham chiếu ví dụ từ vựng rỗng tại lesson " + lesson.id + ".vocabulary[" + index + "]");
    });
    lesson.grammar.forEach((item, index) => aligned(item.exampleSourceRefs, item.examples.length, "lesson " + lesson.id + ".grammar[" + index + "].examples"));
    lesson.pronunciation?.forEach((item, index) => aligned(item.exampleSourceRefs, item.examples.length, "lesson " + lesson.id + ".pronunciation[" + index + "].examples"));
    lesson.extraSections?.forEach((item, index) => aligned(item.contentSourceRefs, item.content.length, "lesson " + lesson.id + ".extraSections[" + index + "].content"));
    if (lesson.writing) aligned(lesson.writing.targetWordSourceRefs, lesson.writing.targetWords.length, "lesson " + lesson.id + ".writing.targetWords");
  }
  const allPagesReviewed = expectedPages.size > 0 && issues.length === 0;
  let represented = 0;
  let practiced = 0;
  let validated = 0;
  const seenItems = new Set<string>();
  const representedLessons = new Set<number>();
  const destinations = new Set<string>();
  for (const item of inventory.items) {
    const key = item.lessonId + ":" + item.id;
    if (seenItems.has(key)) { issues.push("Trùng source item: " + key); continue; }
    seenItems.add(key);
    const pageKey = sourceKey(item.fileName, item.pageNumber);
    const lesson = bundle.course.lessons.find(lesson => lesson.id === item.lessonId);
    const questions = bundle.course.questions.filter(question => question.lessonId === item.lessonId);
    const content = lesson ? resolvePointer({ ...lesson, questions }, item.contentPointer) : undefined;
    const isContentPath = /^\/(vocabulary|grammar|listening|speaking|dialogues|pronunciation|culture|extraSections|questions|media)\/\d+(\/|$)|^\/(reading|writing)(\/|$)/.test(item.contentPointer);
    const destination = JSON.stringify([item.lessonId, item.contentPointer]);
    const repeatedDestination = destinations.has(destination);
    destinations.add(destination);
    if (repeatedDestination) issues.push("Nhiều source item dùng chung đích nội dung: " + key);
    const sectionIndex = /^\/extraSections\/(\d+)(\/|$)/.exec(item.contentPointer)?.[1];
    const isRawTranscript = sectionIndex !== undefined && lesson?.extraSections?.[Number(sectionIndex)]?.kind === "source-transcript";
    const hasContent = isContentPath && !isRawTranscript && !repeatedDestination && content !== undefined && content !== null &&
      (typeof content !== "string" || Boolean(content.trim())) &&
      (!Array.isArray(content) || content.length > 0);
    if (!hasContent || !expectedPages.has(pageKey) || !item.sourceRef.includes(item.fileName)) {
      issues.push("Thiếu nội dung hoặc nguồn cho item " + key + " → " + item.contentPointer);
      continue;
    }
    const targetSourceRef = lesson ? sourceRefAtPointer(lesson, item.contentPointer, content) : undefined;
    if (!targetSourceRef || targetSourceRef !== item.sourceRef.trim()) {
      issues.push("sourceRef inventory không khớp tham chiếu item đích " + key + " → " + item.contentPointer);
      continue;
    }
    represented++;
    representedLessons.add(item.lessonId);
    const linkedQuestions = item.practiceQuestionIds.map(id => questions.find(question =>
      question.id === id && question.sourceRef?.replace(/^Derived from\\s+/i, "").trim() === item.sourceRef));
    const linked = linkedQuestions.length > 0 && linkedQuestions.every(question => question !== undefined);
    const motifMatches = !item.motif || linkedQuestions.some(question => question?.type === item.motif);
    // Workbook coverage requires an explicit exercise target, not merely any lesson content.
    const sectionMatch = /^\/extraSections\/(\d+)(?:\/content\/\d+)?$/.exec(item.contentPointer);
    const section = sectionMatch ? lesson?.extraSections?.[Number(sectionMatch[1])] : undefined;
    const exerciseKind = /(?:exercise|workbook|practice|worksheet|drill|task|problem|question|translation|fill[-_ ]?in|matching|reorder|연습|문제)/i;
    const targetHasContent = typeof content === "string"
      ? Boolean(content.trim())
      : Array.isArray(content)
        ? content.some(value => typeof value === "string" && Boolean(value.trim()))
        : Boolean(section?.content?.some(value => typeof value === "string" && Boolean(value.trim())));
    const explicitExerciseSection = Boolean(
      section && exerciseKind.test(section.kind) && exerciseKind.test(item.kind) && targetHasContent,
    );
    const writing = lesson?.writing;
    const explicitWritingTask = item.contentPointer === "/writing" &&
      /(?:writing|exercise|workbook|practice|worksheet|task|translation|연습|작문)/i.test(item.kind) &&
      Boolean(writing && typeof writing.prompt === "string" && writing.prompt.trim());
    const manualWorkbookTask = item.practiceMethod === "workbook" &&
      item.practiceQuestionIds.length === 0 && (explicitExerciseSection || explicitWritingTask);
    // Every mapped question must resolve to this exact source item. When the reviewed
    // inventory specifies a supported motif, at least one linked question must preserve it.
    if (linked && item.motif && !motifMatches) {
      issues.push("Sai motif luyện tập cho item " + key + ": yêu cầu " + item.motif);
    }
    if ((linked && motifMatches) || manualWorkbookTask) practiced++;
    else if (!linked || !item.motif) issues.push("Thiếu phương thức ôn luyện cho item " + key);
    if (item.verified && reviewedPages.has(pageKey)) validated++;
    else issues.push("Item chưa kiểm chứng: " + key);
  }
  for (const lesson of bundle.course.lessons) {
    if (!representedLessons.has(lesson.id)) issues.push("Lesson chưa có item kiểm kê: " + lesson.id);
  }
  const total = inventory.items.length;
  if (!total) issues.push("Inventory rỗng không chứng minh độ đầy đủ.");
  return {
    auditVersion: CURRICULUM_AUDIT_VERSION,
    status: !issues.length ? "complete" : represented ? "partial" : "blocked",
    basis: "Reconciled against submitted reviewed inventory; not automatic PDF semantic verification",
    sourceCoverage: { ...ratio(represented, total), percent: allPagesReviewed ? ratio(represented, total).percent : null },
    practiceCoverage: ratio(practiced, total),
    validationCoverage: ratio(validated, total), derivedContent, issues,
  };
}
