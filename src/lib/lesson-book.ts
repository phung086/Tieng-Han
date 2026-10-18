import type { LessonContent } from "@/data/content";
import type { ImportJobDocument } from "@/lib/import-jobs";

export type BookPage = { documentId: string; fileName: string; pageNumber: number; role: "lesson" | "related" | "document" };
export type LessonBookManifest = { pages: BookPage[]; documents: ImportJobDocument[]; issues: string[] };

/** References are resolved only against this course's declared documents. */
export function sourcePages(reference: string | undefined, documents: ImportJobDocument[]) {
  const pages: BookPage[] = [];
  const issues: string[] = [];
  if (!reference) return { pages, issues };
  const ranges = [...reference.matchAll(/\bpp?\.\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–—]\s*\d+)?)*)/gi)];
  let previousEnd = 0;
  let selected: ImportJobDocument | undefined;
  let foreignDocument = false;
  for (const [rangeIndex, match] of ranges.entries()) {
    const prefix = reference.slice(previousEnd, match.index);
    const named = documents.map(document => ({ document, at: prefix.toLocaleLowerCase().lastIndexOf(document.fileName.toLocaleLowerCase()) }))
      .filter(item => item.at >= 0 && (item.at === 0 || !/[\p{L}\p{N}_.-]/u.test(prefix[item.at - 1])))
      .sort((a, b) => b.at - a.at || b.document.fileName.length - a.document.fileName.length)[0];
    if (named) { selected = named.document; foreignDocument = false; }
    else if (/\.pdf\b/i.test(prefix) && !/\.{3}\s*pdf\b/i.test(prefix)) {
      issues.push("Nguồn không khớp tài liệu đã nhập: " + prefix.trim()); selected = undefined; foreignDocument = true;
    } else if (!selected && !foreignDocument && documents.length === 1) selected = documents[0];
    if (!selected) { issues.push("Chưa xác định được tài liệu cho " + match[0]); previousEnd = match.index! + match[0].length; continue; }
    for (const part of match[1].split(",")) {
      const [start, end = start] = part.split(/[-–—]/).map(value => Number(value.trim()));
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > selected.pageCount) {
        issues.push("Khoảng trang không hợp lệ: " + selected.fileName + " " + part.trim()); continue;
      }
      for (let pageNumber = start; pageNumber <= end; pageNumber++) pages.push({ documentId: selected.documentId, fileName: selected.fileName, pageNumber, role: rangeIndex === 0 ? "lesson" : "related" });
    }
    previousEnd = match.index! + match[0].length;
  }
  return { pages, issues };
}

function lessonReferences(lesson: LessonContent) {
  return [
    ...lesson.vocabulary.map(item => item.sourceRef), ...lesson.grammar.map(item => item.sourceRef),
    ...lesson.listening.map(item => item.sourceRef), lesson.reading?.sourceRef, lesson.writing?.sourceRef,
    ...(lesson.dialogues ?? []).flatMap(item => [item.sourceRef, ...item.lines.map(line => line.sourceRef)]),
    ...(lesson.pronunciation ?? []).map(item => item.sourceRef), ...(lesson.culture ?? []).map(item => item.sourceRef),
    ...(lesson.extraSections ?? []).map(item => item.sourceRef), ...(lesson.media ?? []).map(item => item.sourceRef),
  ];
}

export function buildLessonBook(lesson: LessonContent, documents: ImportJobDocument[]): LessonBookManifest {
  const primary = sourcePages(lesson.sourceRef, documents);
  const byPage = new Map(primary.pages.map(page => [page.documentId + ":" + page.pageNumber, page]));
  const issues = [...primary.issues];
  for (const reference of new Set(lessonReferences(lesson).filter(Boolean))) {
    const resolved = sourcePages(reference, documents);
    issues.push(...resolved.issues);
    for (const page of resolved.pages) {
      const key = page.documentId + ":" + page.pageNumber;
      if (!byPage.has(key)) byPage.set(key, { ...page, role: "related" });
    }
  }
  const pages = [...byPage.values()].sort((a, b) => Number(a.role === "related") - Number(b.role === "related") || a.documentId.localeCompare(b.documentId) || a.pageNumber - b.pageNumber);
  if (!pages.length) issues.push("Bài học chưa có số trang nguồn đủ rõ để nối hình. Có thể đọc tài liệu ở màn nguồn.");
  return { pages, documents, issues: [...new Set(issues)] };
}

export function pageStudyContent(lesson: LessonContent, page: BookPage, documents: ImportJobDocument[]) {
  const matches = (ref?: string) => sourcePages(ref, documents).pages.some(item => item.documentId === page.documentId && item.pageNumber === page.pageNumber);
  return {
    vocabulary: lesson.vocabulary.filter(item => matches(item.sourceRef)),
    grammar: lesson.grammar.filter(item => matches(item.sourceRef)),
    dialogues: (lesson.dialogues ?? []).filter(item => matches(item.sourceRef) || item.lines.some(line => matches(line.sourceRef))),
  };
}

export function sourceImageUrl(courseId: string, page: Pick<BookPage, "documentId" | "pageNumber">) {
  return "/api/courses/" + encodeURIComponent(courseId) + "/source-image?" + new URLSearchParams({ document: page.documentId, page: String(page.pageNumber) });
}

/** Keep the original snapshot on the server instead of duplicating every page's
 * base64 pixels in a compiled course and in the learner's browser storage. */
export function linkSourcePageMedia(lesson: LessonContent, courseId: string, documents: ImportJobDocument[]): LessonContent {
  return { ...lesson, media: lesson.media?.map(item => {
    const document = documents.find(document => document.fileName === item.fileName);
    if (item.type !== "image" || item.role !== "source-page" || !document || !Number.isSafeInteger(item.pageNumber) || item.pageNumber! < 1 || item.pageNumber! > document.pageCount || !/^data:image\//.test(item.src)) return item;
    return { ...item, src: sourceImageUrl(courseId, { documentId: document.documentId, pageNumber: item.pageNumber! }) };
  }) };
}
