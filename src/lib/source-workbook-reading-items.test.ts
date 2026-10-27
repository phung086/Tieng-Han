import { describe, expect, it } from "vitest";
import type { LessonContent } from "@/data/content";
import { buildSourceWorkbook } from "@/lib/source-workbook";

function readingLesson(overrides: Partial<NonNullable<LessonContent["reading"]>> = {}): LessonContent {
  return {
    id: 3,
    title: "제3과",
    vi: "Bài 3",
    objective: "Synthetic reading-item regression fixture",
    sourceRef: "book.pdf · p.4 · lesson",
    vocabulary: [],
    grammar: [],
    listening: [],
    speaking: [],
    reading: {
      title: "주말에 무엇을 합니까?",
      text: "저는 주말에 친구를 만납니다.",
      translation: "Cuối tuần tôi gặp bạn.",
      questions: [],
      sourceRef: "book.pdf · p.4 · reading-section",
      titleSourceRef: "book.pdf · p.4 · reading-title",
      textSourceRef: "book.pdf · p.4 · reading-text",
      ...overrides,
    },
    writing: null,
    dialogues: [],
    pronunciation: [],
    culture: [],
    extraSections: [],
  };
}

describe("source workbook reading item provenance", () => {
  it("keeps an inventoried reading title separate from the passage and uses each exact ref", () => {
    const items = buildSourceWorkbook(readingLesson(), []);
    const title = items.find(item => item.id === "source:3:reading-title:0:0");
    const passage = items.find(item => item.id === "source:3:reading-passage:0:0");

    expect(title).toMatchObject({
      prompt: "주말에 무엇을 합니까?",
      sourceRef: "book.pdf · p.4 · reading-title",
    });
    expect(passage).toMatchObject({
      prompt: "저는 주말에 친구를 만납니다.",
      sourceRef: "book.pdf · p.4 · reading-text",
    });
    expect(title?.sourceRef).not.toBe(passage?.sourceRef);
  });

  it("does not substitute the reading-section or lesson ref when title/text refs are missing", () => {
    const items = buildSourceWorkbook(readingLesson({
      titleSourceRef: undefined,
      textSourceRef: undefined,
    }), []);
    const title = items.find(item => item.id === "source:3:reading-title:0:0");
    const passage = items.find(item => item.id === "source:3:reading-passage:0:0");

    expect(title?.prompt).toBe("주말에 무엇을 합니까?");
    expect(passage?.prompt).toBe("저는 주말에 친구를 만납니다.");
    expect(title?.sourceRef).toBeUndefined();
    expect(passage?.sourceRef).toBeUndefined();
  });
});
