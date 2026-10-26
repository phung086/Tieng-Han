import { describe, expect, it } from "vitest";
import type { LessonContent, StudyQuestion } from "@/data/content";
import {
  chunkSourcePages,
  formatSourcePages,
  mergeGeneratedLessonChunks,
  retainSourceTranscripts,
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

  it("does not split supplementary Unicode code points across source chunks", () => {
    const maxCharacters = 500;
    const page = examplePage(13, "");
    const firstLabel = "[SOURCE: " + page.fileName + " · p." + page.pageNumber + " · part 1]\n";
    const capacity = maxCharacters - firstLabel.length - 2;
    const source = "a".repeat(capacity - 1) + "𠀀" + "z".repeat(40);
    const parts = chunkSourcePages([examplePage(13, source)], maxCharacters, 8);
    const pieces = parts.flat().map(part => part.text);

    expect(pieces.join("")).toBe(source);
    expect(pieces.some(piece => /[\uD800-\uDBFF]$/.test(piece))).toBe(false);
    expect(pieces.some(piece => /^[\uDC00-\uDFFF]/.test(piece))).toBe(false);
    expect(parts.every(part => formatSourcePages(part).length <= maxCharacters)).toBe(true);
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
  it("keeps all original page characters separately from authored content, including the final page", () => {
    const pages = [examplePage(10, "original instruction\n① choice A ② choice B"), examplePage(11, "last source word"), examplePage(12, "", true)];
    const result = retainSourceTranscripts(3, { lesson: lesson(1), questions: questions(1, 2) }, pages);
    const transcripts = result.lesson.extraSections!.filter(item => item.kind === "source-transcript");
    expect(transcripts).toHaveLength(3);
    expect(transcripts[0].content).toEqual([pages[0].text]);
    expect(transcripts[1].content).toEqual([pages[1].text]);
    expect(transcripts[2].sourceRef).toContain("p.12");
    expect(result.lesson.vocabulary).toHaveLength(60);
  });
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
    expect(combined.lesson.speakingSourceRefs).toBeUndefined();
    expect(combined.questions).toHaveLength(241);
    expect(combined.questions.at(-1)?.prompt).toBe("Từ 3-75");
    expect(new Set(combined.questions.map(q => q.id)).size).toBe(241);
    expect(new Set(combined.lesson.vocabulary.map(q => q.id)).size).toBe(180);
    expect(combined.lesson.reading?.title).toBe("Bài đọc phần 2");
    expect(combined.lesson.writing?.prompt).toBe("Hãy viết phần 2");
    const rest = combined.lesson.extraSections ?? [];
    expect(rest).toHaveLength(13);
    expect(rest.some(s => s.title === "Bài đọc phần 3" && s.content.includes("저는 학생입니다 3"))).toBe(true);
    expect(rest.some(s => s.title === "Nhiệm vụ viết · phần 3" && s.content.includes("Hãy viết phần 3"))).toBe(true);
    expect(rest.find(s => s.id === "chunk3:reading:passage")?.sourceRef).toBeUndefined();
    expect(rest.find(s => s.id === "chunk3:reading:question:read-1")?.sourceRef).toBeUndefined();
    expect(rest.find(s => s.id === "chunk3:reading:question:read-1:choice:1")?.sourceRef).toBeUndefined();
    expect(rest.find(s => s.id === "chunk3:writing:prompt")?.sourceRef).toBeUndefined();
    expect(rest.find(s => s.id === "chunk3:writing:target-word:1")?.sourceRef).toBeUndefined();
  });

  it("merges speaking refs in exact sentence order and marks legacy chunk sentences unverified", () => {
    const first = { ...lesson(1), speaking: ["안녕하세요."] };
    const second = {
      ...lesson(2),
      speaking: ["감사합니다.", "안녕히 가세요."],
      speakingSourceRefs: [
        "Sơ cấp 1.pdf · p.22 · speaking-1",
        "Sơ cấp 1.pdf · p.22 · speaking-2",
      ],
    };
    const combined = mergeGeneratedLessonChunks(3, [
      { lesson: first, questions: [] },
      { lesson: second, questions: [] },
    ]);

    expect(combined.lesson.speaking).toEqual([
      "안녕하세요.", "감사합니다.", "안녕히 가세요.",
    ]);
    expect(combined.lesson.speakingSourceRefs).toEqual([
      null,
      "Sơ cấp 1.pdf · p.22 · speaking-1",
      "Sơ cấp 1.pdf · p.22 · speaking-2",
    ]);
  });

  it("preserves exact nested reading and writing refs when secondary chunks are flattened", () => {
    const third = lesson(3, true, true);
    const reading = {
      ...third.reading!,
      titleSourceRef: "Sơ cấp 1.pdf · p.23 · reading-title",
      textSourceRef: "Sơ cấp 1.pdf · p.23 · reading-passage",
      questions: third.reading!.questions.map(question => ({
        ...question,
        sourceRef: "Sơ cấp 1.pdf · p.23 · question-1",
        choiceSourceRefs: [
          "Sơ cấp 1.pdf · p.23 · choice-1",
          "Sơ cấp 1.pdf · p.23 · choice-2",
        ],
        answerSourceRef: "Sơ cấp 1.pdf · p.99 · answer-1",
      })),
    };
    const writing = {
      ...third.writing!,
      promptSourceRef: "Sơ cấp 1.pdf · p.24 · writing-prompt",
      targetWordSourceRefs: [
        "Sơ cấp 1.pdf · p.24 · target-word-1",
        "Sơ cấp 1.pdf · p.24 · target-word-2",
      ],
    };
    const combined = mergeGeneratedLessonChunks(3, [
      { lesson: lesson(1, false, false), questions: [] },
      { lesson: lesson(2, true, true), questions: [] },
      { lesson: { ...third, reading, writing }, questions: [] },
    ]);
    const items = combined.lesson.extraSections ?? [];
    const ref = (id: string) => items.find(item => item.id === id)?.sourceRef;

    expect(ref("chunk3:reading:title")).toBe("Sơ cấp 1.pdf · p.23 · reading-title");
    expect(ref("chunk3:reading:passage")).toBe("Sơ cấp 1.pdf · p.23 · reading-passage");
    expect(ref("chunk3:reading:question:read-1")).toBe("Sơ cấp 1.pdf · p.23 · question-1");
    expect(ref("chunk3:reading:question:read-1:choice:1")).toBe("Sơ cấp 1.pdf · p.23 · choice-1");
    expect(ref("chunk3:reading:question:read-1:choice:2")).toBe("Sơ cấp 1.pdf · p.23 · choice-2");
    expect(ref("chunk3:reading:question:read-1:answer")).toBe("Sơ cấp 1.pdf · p.99 · answer-1");
    expect(ref("chunk3:writing:prompt")).toBe("Sơ cấp 1.pdf · p.24 · writing-prompt");
    expect(ref("chunk3:writing:target-word:1")).toBe("Sơ cấp 1.pdf · p.24 · target-word-1");
    expect(ref("chunk3:writing:target-word:2")).toBe("Sơ cấp 1.pdf · p.24 · target-word-2");
    expect(items.find(item => item.id === "chunk3:reading:question:read-1:answer")?.content).toEqual(["학생"]);
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
