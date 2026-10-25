import { describe, expect, it } from "vitest";
import type { LessonContent } from "@/data/content";
import { buildSourceWorkbook } from "@/lib/source-workbook";

const EMPTY_PROMPT = "Nội dung nguồn trống — cần đối chiếu PDF.";

function lessonWithEmptySourceSlots(): LessonContent {
  return {
    id: 9,
    title: "제9과",
    vi: "Bài 9",
    objective: "Synthetic regression fixture",
    sourceRef: "Sách.pdf · p.1",
    vocabulary: [{ id: "v1", ko: "학생", vi: "học sinh", example: "", sourceRef: "Sách.pdf · p.1 · v1" }],
    grammar: [{
      id: "g1", pattern: "-입니다", meaning: "là", explanation: "Lối nói trang trọng",
      examples: [""], sourceRef: "Sách.pdf · p.2 · g1",
    }],
    listening: [{
      id: "l1", text: "", meaning: "Ai vậy?", choices: ["학생", "의사"], answer: "학생",
      sourceRef: "Sách.pdf · p.3 · l1",
    }],
    speaking: [""],
    reading: null,
    writing: { prompt: "", hint: "Tự giới thiệu", targetWords: [], sourceRef: "Sách.pdf · p.4 · writing" },
    dialogues: [],
    pronunciation: [],
    culture: [],
    extraSections: [{
      id: "ex1", kind: "original-activities", title: "Bài tập gốc",
      content: [""], sourceRef: "Sách.pdf · p.5 · ex1",
    }],
  };
}

describe("empty source workbook slots", () => {
  it("keeps empty source-backed slots visible as unverified review placeholders", () => {
    const items = buildSourceWorkbook(lessonWithEmptySourceSlots(), []);
    const placeholders = items.filter(item => item.prompt === EMPTY_PROMPT);

    expect(placeholders).toHaveLength(5);
    expect(placeholders.map(item => item.id)).toEqual([
      "source:9:grammar-example-0:0:0",
      "source:9:listening:0:0",
      "source:9:speaking:0:0",
      "source:9:writing:0:0",
      "source:9:extra-0:0:0",
    ]);
    expect(placeholders.every(item => item.category === "Nguồn dự phòng · chưa tính là bài biên soạn")).toBe(true);
    expect(placeholders.every(item => item.answer === undefined && item.choices === undefined)).toBe(true);
    expect(placeholders.every(item => item.hint?.includes("đối chiếu PDF"))).toBe(true);
  });

  it("does not replace valid source text or drop blank original exercise subparts", () => {
    const lesson = lessonWithEmptySourceSlots();
    lesson.extraSections![0].content = ["Bài tập gốc hợp lệ", ""];
    const items = buildSourceWorkbook(lesson, []);

    expect(items.some(item => item.prompt === "학생" && item.category === "Từ vựng")).toBe(true);
    expect(items.some(item => item.prompt === "Bài tập gốc hợp lệ" && item.category === "Bài tập gốc")).toBe(true);
    expect(items.some(item => item.id === "source:9:extra-0:1:0" && item.prompt === EMPTY_PROMPT)).toBe(true);
  });
});
