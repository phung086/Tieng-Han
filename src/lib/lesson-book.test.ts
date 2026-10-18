import { describe, expect, it } from "vitest";
import type { LessonContent } from "@/data/content";
import { buildLessonBook, linkSourcePageMedia, pageStudyContent, sourcePages } from "./lesson-book";

const documents = [{ documentId: "book", fileName: "book.pdf", pageCount: 100 }, { documentId: "work", fileName: "workbook.pdf", pageCount: 50 }];
const lesson: LessonContent = { id: 9, title: "학교", vi: "Trường học", objective: "Read", sourceRef: "book.pdf · pp.20–42; answers p.90,92",
  vocabulary: [{ id: "v", ko: "학교", vi: "trường học", example: "", sourceRef: "book.pdf · p.22" }],
  grammar: [{ id: "g", pattern: "입니다", meaning: "là", explanation: "Guide", examples: [], sourceRef: "book.pdf · p.24" }],
  listening: [], speaking: [], reading: null, writing: null,
  extraSections: [{ id: "x", kind: "original-appendix", title: "Answers", content: ["source"], sourceRef: "workbook.pdf · pp.46-50" }],
};

describe("illustrated lesson page mapping", () => {
  it("keeps every page of long chapters plus all referenced appendix pages", () => {
    const manifest = buildLessonBook(lesson, documents);
    expect(manifest.pages.filter(page => page.role === "lesson")).toHaveLength(23);
    expect(manifest.pages).toHaveLength(30);
    expect(manifest.pages).toContainEqual({ documentId: "work", fileName: "workbook.pdf", pageNumber: 50, role: "related" });
    expect(manifest.issues).toEqual([]);
  });
  it("distinguishes overlapping filenames and identical page numbers in different documents", () => {
    const pages = sourcePages("workbook.pdf p.20; book.pdf p.20", documents).pages;
    expect(pages.map(page => page.documentId)).toEqual(["work", "book"]);
  });
  it("never guesses an undeclared filename or a document in an ambiguous multi-file reference", () => {
    expect(sourcePages("foreign.pdf pp.1-3; answers p.4", [documents[0]]).pages).toEqual([]);
    expect(sourcePages("p.10", documents).pages).toEqual([]);
    expect(sourcePages("book.pdf pp.42-20; p.101", documents).issues).toHaveLength(2);
    expect(sourcePages("SBT...pdf pp.3-7", [documents[1]]).pages).toHaveLength(5);
  });
  it("links study content to its exact original page, preserving all entries", () => {
    const manifest = buildLessonBook(lesson, documents);
    const page = manifest.pages.find(page => page.documentId === "book" && page.pageNumber === 22)!;
    expect(pageStudyContent(lesson, page, documents).vocabulary.map(item => item.id)).toEqual(["v"]);
    expect(pageStudyContent(lesson, page, documents).grammar).toEqual([]);
    expect(pageStudyContent(lesson, { ...page, documentId: "work", fileName: "workbook.pdf" }, documents).vocabulary).toEqual([]);
  });
  it("references source-page pixels without dropping media or replacing unrelated illustrations", () => {
    const original: LessonContent = { ...lesson, media: [
      { id: "page", type: "image", role: "source-page", src: "data:image/png;base64,original", alt: "Source", fileName: "book.pdf", pageNumber: 25 },
      { id: "picture", type: "image", role: "illustration", src: "data:image/png;base64,picture", alt: "Original figure" },
    ] };
    const linked = linkSourcePageMedia(original, "course-import-source", documents);
    expect(linked.media).toHaveLength(2);
    expect(linked.media?.[0].src).toBe("/api/courses/course-import-source/source-image?document=book&page=25");
    expect(linked.media?.[1]).toEqual(original.media?.[1]);
    expect(original.media?.[0].src).toContain("base64,original");
    expect(linked.vocabulary).toEqual(original.vocabulary);
  });
});
