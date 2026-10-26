import { describe, expect, it } from "vitest";
import { course, studyQuestions } from "@/lib/testing/study-fixture";
import type { RuntimeCourse } from "@/lib/content-store";
import { coachEvidence } from "@/lib/lesson-coach";

const lessonIndex = 2;

function withLesson(overrides: Record<string, unknown>, questionOverrides: Record<string, unknown> = {}): RuntimeCourse {
  const base = course.lessons[lessonIndex];
  const lesson = { ...base, ...overrides } as unknown as (typeof course.lessons)[number];
  return {
    ...course,
    lessons: [...course.lessons.slice(0, lessonIndex), lesson],
    questions: studyQuestions.map(question => ({ ...question, ...questionOverrides })),
  } as RuntimeCourse;
}

describe("lesson coach source attribution", () => {
  it("never presents a lesson-level reference as evidence for unreferenced child items", () => {
    const base = course.lessons[lessonIndex];
    const unverifiedCourse = withLesson({
      sourceRef: "textbook.pdf · p.30 · lesson",
      vocabulary: base.vocabulary.map(item => ({ ...item, sourceRef: undefined, exampleSourceRef: undefined })),
      grammar: base.grammar.map(item => ({ ...item, sourceRef: undefined, exampleSourceRefs: undefined })),
      reading: base.reading ? { ...base.reading, sourceRef: undefined, translationSourceRef: undefined } : null,
      pronunciation: [{
        id: "pron-unverified",
        title: "Phát âm",
        explanation: "Ghi chú",
        examples: ["학교"],
        sourceRef: undefined,
        exampleSourceRefs: [null],
      }],
      culture: [{ id: "culture-unverified", title: "Văn hóa", text: "Ghi chú", sourceRef: undefined }],
    }, { sourceRef: undefined, answerSourceRef: undefined });

    const evidence = coachEvidence(unverifiedCourse, 3);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every(item => item.source === "Chưa xác minh nguồn")).toBe(true);
    expect(evidence.find(item => item.id === "v-school")?.exampleSources).toEqual(["Chưa xác minh nguồn"]);
    expect(evidence.find(item => item.id === "g")?.exampleSources.every(source => source === "Chưa xác minh nguồn")).toBe(true);
    expect(evidence.some(item => item.source.includes("textbook.pdf"))).toBe(false);
  });

  it("uses exact item and child refs without replacing the displayed source text", () => {
    const base = course.lessons[lessonIndex];
    const verifiedCourse = withLesson({
      sourceRef: "textbook.pdf · p.30 · lesson",
      vocabulary: [{
        ...base.vocabulary[0],
        sourceRef: "textbook.pdf · p.30 · word-1",
        exampleSourceRef: "textbook.pdf · p.30 · word-example-1",
      }],
      grammar: [{
        ...base.grammar[0],
        sourceRef: "textbook.pdf · p.31 · grammar-1",
        exampleSourceRefs: ["textbook.pdf · p.31 · grammar-example-1", null, null],
      }],
      reading: base.reading ? {
        ...base.reading,
        sourceRef: "textbook.pdf · p.32 · passage-1",
        translationSourceRef: "textbook.pdf · p.32 · translation-1",
      } : null,
      pronunciation: [{
        id: "pron-verified",
        title: "Phát âm",
        explanation: "Ghi chú",
        examples: ["학교"],
        sourceRef: "textbook.pdf · p.33 · pronunciation-1",
        exampleSourceRefs: ["textbook.pdf · p.33 · pronunciation-example-1"],
      }],
    }, {
      sourceRef: "textbook.pdf · p.34 · question-1",
      answerSourceRef: "textbook.pdf · p.34 · answer-1",
    });

    const evidence = coachEvidence(verifiedCourse, 3);
    expect(evidence.find(item => item.id === base.vocabulary[0].id)).toMatchObject({
      source: "textbook.pdf · p.30 · word-1",
      exampleSources: ["textbook.pdf · p.30 · word-example-1"],
    });
    expect(evidence.find(item => item.id === base.grammar[0].id)).toMatchObject({
      source: "textbook.pdf · p.31 · grammar-1",
      exampleSources: ["textbook.pdf · p.31 · grammar-example-1", "Chưa xác minh nguồn", "Chưa xác minh nguồn"],
    });
    expect(evidence.find(item => item.id === "g-3-1")).toMatchObject({
      source: "textbook.pdf · p.34 · question-1",
      exampleSources: ["textbook.pdf · p.34 · answer-1"],
    });
    expect(evidence.find(item => item.id === "reading:3")).toMatchObject({
      source: "textbook.pdf · p.32 · passage-1",
      exampleSources: ["textbook.pdf · p.32 · translation-1"],
    });
  });
});
