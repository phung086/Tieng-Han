import { describe, expect, it } from "vitest";
import type { LessonContent, StudyQuestion } from "@/data/content";
import {
  chunkSourcePages,
  formatSourcePages,
  mergeGeneratedLessonChunks,
} from "@/lib/source-chunk-compilation";

const examplePage = (n: number, text: string, visual = false) => ({
  fileName: "Sơ cấp 1.pdf",
  pageNumber: n,
  text,
  ...(visual ? { imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==" } : {}),
});

function lesson(number: number, reading = false, writing = false): LessonContent {
  return {
    id: 3,
    title: "제3과",
    vi: "Bài 3",
    objective: "Đọc nguồn phần " + number,
    vocabulary: Array.from({ length: 60 }, (_, i) => ({
      id: "v-" + i,
      ko: "단어" + number + "-" + i,
      vi: "từ " + i,
      example: "예문 " + i,
      sourceRef: "Sơ cấp 1.pdf · p." + (number + 20),
    })),
    grammar: [{ id: "g1", pattern: "입니다", meaning: "là",
      explanation: "Ngữ pháp nguồn", examples: ["저는 학생입니다."] }],
    listening: [],
    speaking: ["안녕하세요."],
    dialogues: [{ id: "d1", lines: [{ ko: "저는 학생입니다.", vi: "Tôi là học sinh." }] }],
    pronunciation: [{ id: "p1", title: "Âm", explanation: "Phát âm",
      examples: ["한국어"] }],
    culture: [{ id: "c1", title: "Văn hóa", text: "Văn hóa trong sách" }],
    extraSections: [{
      id: "exercise-1", kind: "practice",
      title: "Bài tập nguồn", content: ["Câu 1", "Câu 2"],
    }],
    media: [],
    reading: reading ? {
      title: "Bài đọc phần " + number,
      text: "저는 학생입니다 " + number,
      translation: "Tôi là học sinh " + number,
      questions: [{ id: "read-1", q: "누구입니까?", choices: ["학생", "교수"], answer: "학생" }],
    } : null,
    writing: writing ? {
      prompt: "Hãy viết phần " + number,
      hint: "Dùng các mẫu vừa học",
      targetWords: ["학생", "저"],
    } : null,
    sourceRef: "Sơ cấp 1.pdf · p." + (number + 20),
  };
}

function questions(chunk: number, n: number): StudyQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: "q-" + i,
    lessonId: 3,
    skill: "vocabulary",
    type: "input",
    title: "Câu " + i,
    prompt: "Từ " + chunk + "-" + i,
    answer: "단어" + i,
    explanation: "Theo sách",
    sourceRef: "Sơ cấp 1.pdf · p." + (chunk + 20),
  }));
}

describe("source page batching", () => {
  it("retains every character in 160 source pages and respects the per-request budget", () => {
    const original = Array.from({ length: 160 }, (_, i) =>
      examplePage(i + 1, "문장 " + i + " ".repeat(400) + "끝 " + i, i % 2 === 0),
    );
    const parts = chunkSourcePages(original, 3_000, 8);
    const all = parts.flat();
    expect(parts.length).toBeGreaterThan(1);
    expect(all.map(p => p.text).join("")).toBe(original.map(p => p.text).join(""));
    expect(all.map(p => p.pageNumber)).toEqual(original.map(p => p.pageNumber));
    expect(parts.every(part => formatSourcePages(part).length <= 3_000)).toBe(true);
    expect(parts.every(part => part.filter(p => p.imageDataUrl).length <= 8)).toBe(true);
    expect(all.at(-1)?.text).toContain("끝 159");
  });

  it("splits a single oversized source page without losing trailing characters", () => {
    const source = "한글".repeat(6_000) + "마지막 부분";
    const parts = chunkSourcePages([examplePage(11, source, true)], 1_200, 8);
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.flat().map(p => p.text).join("")).toBe(source);
    expect(parts.every(part => formatSourcePages(part).length <= 1_200)).toBe(true);
  });

  it("keeps image-only pages with empty extractable text", () => {
    const parts = chunkSourcePages(
      Array.from({ length: 32 }, (_, i) => examplePage(i + 1, "", true)),
      1_200,
      8,
    );
    expect(parts.flat()).toHaveLength(32);
    expect(parts.every(part => part.length <= 8)).toBe(true);
  });
});

describe("merging full textbook content", () => {
  it("merges 180 words and 241 questions instead of truncating to a quiz target", () => {
    const results = [
      { lesson: lesson(1, false, false), questions: questions(1, 85) },
      { lesson: lesson(2, true, true), questions: questions(2, 80) },
      { lesson: lesson(3, true, true), questions: questions(3, 76) },
    ];
    const combined = mergeGeneratedLessonChunks(3, results);
    expect(combined.lesson.vocabulary).toHaveLength(180);
    expect(combined.lesson.grammar).toHaveLength(3);
    expect(combined.lesson.speaking).toHaveLength(3);
    expect(combined.questions).toHaveLength(241);
    expect(combined.questions.at(-1)?.prompt).toBe("Từ 3-75");
    expect(new Set(combined.questions.map(q => q.id)).size).toBe(241);
    expect(new Set(combined.lesson.vocabulary.map(q => q.id)).size).toBe(180);
    expect(combined.lesson.reading?.title).toBe("Bài đọc phần 2");
    expect(combined.lesson.writing?.prompt).toBe("Hãy viết phần 2");
    const rest = combined.lesson.extraSections ?? [];
    expect(rest).toHaveLength(5);
    expect(rest.some(s => s.title === "Bài đọc phần 3" && s.content.includes("저는 학생입니다 3"))).toBe(true);
    expect(rest.some(s => s.title === "Nhiệm vụ viết · phần 3" && s.content.includes("Hãy viết phần 3"))).toBe(true);
  });

  it("never accepts an invalid or missing compiled segment as a silent success", () => {
    expect(() => mergeGeneratedLessonChunks(3, [])).toThrow("No source chunks");
    expect(() => mergeGeneratedLessonChunks(3, [
      { lesson: lesson(1), questions: [] }, { lesson: null, questions: [] },
    ])).toThrow("chunk 2");
    expect(() => mergeGeneratedLessonChunks(3, [
      { lesson: { ...lesson(1), dialogues: "malformed but previously discarded" }, questions: [] },
    ])).toThrow("dialogues");
  });
});
