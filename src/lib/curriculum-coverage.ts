import { z } from "zod";
import type { CompiledCourseBundle } from "@/lib/course-bundle";

const nonempty = z.string().trim().min(1);
export const sourceInventorySchema = z.object({
  version: z.literal(1),
  pages: z.array(z.object({
    fileName: nonempty, pageNumber: z.number().int().positive(),
    status: z.enum(["reviewed", "unavailable"]), reason: nonempty.optional(),
  })),
  items: z.array(z.object({
    id: nonempty, lessonId: z.number().int().positive(), kind: nonempty,
    fileName: nonempty, pageNumber: z.number().int().positive(), sourceRef: nonempty,
    // JSON pointer relative to the lesson, e.g. /vocabulary/0 or /grammar/0/examples/1.
    contentPointer: nonempty,
    practiceMethod: z.enum(["questions", "workbook"]),
    practiceQuestionIds: z.array(nonempty).default([]), verified: z.boolean(),
  })),
});
export type SourceInventory = z.infer<typeof sourceInventorySchema>;
export type CoverageRatio = { covered: number; total: number; percent: number | null };
export type CurriculumCoverage = {
  status: "unverified" | "partial" | "blocked" | "complete";
  basis: string;
  sourceCoverage: CoverageRatio;
  practiceCoverage: CoverageRatio;
  validationCoverage: CoverageRatio;
  derivedContent: number;
  issues: string[];
};
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

/** Structural reconciliation against a submitted, independently reviewed source
 * inventory. It does not pretend that schema validation reads the PDF itself.
 */
export function auditCurriculumCoverage(bundle: CompiledCourseBundle): CurriculumCoverage {
  const derivedContent = bundle.course.questions.filter(question => question.origin === "derived").length;
  const empty = { sourceCoverage: ratio(0, 0), practiceCoverage: ratio(0, 0), validationCoverage: ratio(0, 0), derivedContent };
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
    const hasContent = isContentPath && !repeatedDestination && content !== undefined && content !== null &&
      (typeof content !== "string" || Boolean(content.trim())) &&
      (!Array.isArray(content) || content.length > 0);
    if (!hasContent || !expectedPages.has(pageKey) || !item.sourceRef.includes(item.fileName)) {
      issues.push("Thiếu nội dung hoặc nguồn cho item " + key + " → " + item.contentPointer);
      continue;
    }
    represented++;
    representedLessons.add(item.lessonId);
    const linked = item.practiceQuestionIds.length > 0 && item.practiceQuestionIds.every(id => questions.some(question =>
      question.id === id && question.sourceRef?.replace(/^Derived from\s+/i, "").trim() === item.sourceRef));
    // The workbook renders these lesson fields as manual learning/response tasks.
    const workbookContent = /^\/(vocabulary|grammar|listening|speaking|reading|writing|dialogues|pronunciation|culture|extraSections|questions|media)(\/|$)/.test(item.contentPointer);
    if ((item.practiceMethod === "workbook" && workbookContent) || linked) practiced++;
    else issues.push("Thiếu phương thức ôn luyện cho item " + key);
    if (item.verified && reviewedPages.has(pageKey)) validated++;
    else issues.push("Item chưa kiểm chứng: " + key);
  }
  for (const lesson of bundle.course.lessons) {
    if (!representedLessons.has(lesson.id)) issues.push("Lesson chưa có item kiểm kê: " + lesson.id);
  }
  const total = inventory.items.length;
  if (!total) issues.push("Inventory rỗng không chứng minh độ đầy đủ.");
  return {
    status: !issues.length ? "complete" : represented ? "partial" : "blocked",
    basis: "Reconciled against submitted reviewed inventory; not automatic PDF semantic verification",
    sourceCoverage: { ...ratio(represented, total), percent: allPagesReviewed ? ratio(represented, total).percent : null },
    practiceCoverage: ratio(practiced, total),
    validationCoverage: ratio(validated, total), derivedContent, issues,
  };
}
