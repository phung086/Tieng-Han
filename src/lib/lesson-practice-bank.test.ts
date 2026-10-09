import { describe, expect, it } from "vitest";
import type { LessonContent, StudyQuestion } from "@/data/content";
import { buildLessonPracticeBank, summarizeLessonPractice } from "@/lib/lesson-practice-bank";
import { buildSourceWorkbook } from "@/lib/source-workbook";

function lesson(wordCount = 3): LessonContent {
  return {
    id: 4,
    title: "제4과",
    vi: "Bài 4",
    objective: "Nguồn giáo trình",
    sourceRef: "Sách p.21",
    vocabulary: Array.from({ length: wordCount }, (_, i) => ({
      id: "word-" + i, ko: "단어" + i, vi: "nghĩa " + i,
      example: "예문 " + i, sourceRef: "Sách p.22",
    })),
    grammar: [{
      id: "g1", pattern: "-입니다", meaning: "là", explanation: "Lối nói trang trọng",
      examples: ["저는 학생입니다.", "여기는 학교입니다."], sourceRef: "Sách p.23",
    }],
    listening: [{
      id: "l1", text: "누구입니까?", meaning: "Ai vậy?",
      choices: ["학생", "선생님"], answer: "학생", sourceRef: "Sách p.24",
    }],
    speaking: ["안녕하세요.", "감사합니다."],
    reading: {
      title: "읽기", text: "저는 학생입니다.", translation: "Tôi là học sinh.",
      questions: [{ id: "r1", q: "누구입니까?", choices: ["학생", "의사"], answer: "학생", sourceRef: "Sách p.25" }],
      sourceRef: "Sách p.25",
    },
    writing: { prompt: "Viết giới thiệu", hint: "Dùng -입니다", targetWords: ["저", "학생"], sourceRef: "Sách p.26" },
    dialogues: [{
      id: "d1", title: "대화", sourceRef: "Sách p.27",
      lines: [
        { speaker: "A", ko: "안녕하세요.", vi: "Xin chào." },
        { speaker: "B", ko: "반갑습니다.", vi: "Rất vui được gặp." },
      ],
    }],
    pronunciation: [{
      id: "p1", title: "받침", explanation: "Luyện patchim",
      examples: ["한국", "책"], sourceRef: "Sách p.28",
    }],
    culture: [{ id: "c1", title: "Văn hoá", text: "Chào hỏi", sourceRef: "Sách p.29" }],
    extraSections: [{
      id: "ex1", kind: "Bài tập", title: "Dịch", content: ["1. Xin chào", "2. Tôi là học sinh"], sourceRef: "Sách p.30",
    }],
  };
}

const original: StudyQuestion[] = [{
  id: "textbook-q", lessonId: 4, skill: "grammar", type: "input",
  title: "Câu hỏi sách", prompt: "Nói tôi là học sinh", answer: "저는 학생입니다.",
  explanation: "Nguyên bản", sourceRef: "Sách p.31",
}];

describe("exhaustive deterministic practice", () => {
  it("generates source-grounded questions from every answerable source entry", () => {
    const input = lesson();
    const bank = buildLessonPracticeBank(input, original);
    expect(bank[0]).toEqual(original[0]);
    expect(bank.filter(q => q.id.includes("vocab-meaning"))).toHaveLength(3);
    expect(bank.filter(q => q.id.includes("vocab-recall"))).toHaveLength(3);
    expect(bank.filter(q => q.id.includes("vocab-example"))).toHaveLength(3);
    expect(bank.filter(q => q.id.includes("grammar-pattern"))).toHaveLength(1);
    expect(bank.filter(q => q.id.includes("grammar-example"))).toHaveLength(2);
    expect(bank.filter(q => q.id.includes(":listening:"))).toHaveLength(1);
    expect(bank.filter(q => q.id.includes(":reading:"))).toHaveLength(1);
    expect(bank.filter(q => q.id.includes(":dialogue-"))).toHaveLength(2);
    expect(bank.filter(q => q.id.includes(":speaking:"))).toHaveLength(2);
    expect(bank.filter(q => q.id.includes(":pronunciation-"))).toHaveLength(2);
    expect(bank.filter(q => q.id.includes(":writing-word:"))).toHaveLength(2);
    expect(new Set(bank.map(q => q.id)).size).toBe(bank.length);
    expect(bank.every(q => q.lessonId === 4 && !!q.answer && !!q.prompt)).toBe(true);
    expect(bank.every(q => !q.sourceRef || q.sourceRef.startsWith("Sách"))).toBe(true);
    expect(bank.filter(q => q.type === "choice").every(q => q.choices?.includes(q.answer))).toBe(true);
    expect(summarizeLessonPractice(input, original).totalQuestions).toBe(bank.length);
    expect(buildLessonPracticeBank(input, original)).toEqual(bank);
  });

  it("is not limited to 5/6/8/10/20 words even when only one imported quiz exists", () => {
    const input = lesson(73);
    const bank = buildLessonPracticeBank(input, original);
    expect(bank.filter(q => q.id.includes("vocab-meaning"))).toHaveLength(73);
    expect(bank.filter(q => q.id.includes("vocab-recall"))).toHaveLength(73);
    expect(bank.filter(q => q.id.includes("vocab-example"))).toHaveLength(73);
    expect(bank.length).toBeGreaterThan(200);
    expect(bank.filter(q => q.id.includes("vocab-meaning")).some(q => q.answer === "nghĩa 72")).toBe(true);
  });

  it("does not manufacture graded answers for untranslated dialogue or open writing", () => {
    const input = lesson(1);
    input.dialogues![0].lines[1].vi = "";
    const bank = buildLessonPracticeBank(input, []);
    expect(bank.filter(q => q.id.includes(":dialogue-"))).toHaveLength(1);
    expect(bank.some(q => q.prompt === input.writing!.prompt && q.answer)).toBe(false);
  });

  it("rotates answers among distractors rather than keeping every correct option first", () => {
    const bank = buildLessonPracticeBank(lesson(5), []);
    const choicePositions = bank.filter(q => q.id.includes("vocab-meaning"))
      .map(q => q.choices?.indexOf(q.answer));
    expect(new Set(choicePositions).size).toBeGreaterThan(1);
  });
});

describe("full-fidelity source workbook", () => {
  it("includes every source entry, sample, dialogue line, original question and extra line", () => {
    const items = buildSourceWorkbook(lesson(73), original);
    const count = (category: string) => items.filter(q => q.category === category).length;
    expect(count("Từ vựng")).toBe(146);
    expect(count("Ngữ pháp")).toBe(3);
    expect(count("Nghe")).toBe(1);
    expect(count("Nói")).toBe(2);
    expect(count("Đọc")).toBe(2);
    expect(count("Viết")).toBe(1);
    expect(count("Hội thoại")).toBe(2);
    expect(count("Phát âm")).toBe(3);
    expect(count("Văn hóa")).toBe(1);
    expect(count("Bài tập bổ sung")).toBe(2);
    expect(count("Câu hỏi đã nhập")).toBe(1);
    expect(new Set(items.map(q => q.id)).size).toBe(items.length);
    expect(items.find(q => q.prompt === "2. Tôi là học sinh")?.sourceRef).toBe("Sách p.30");
  });

  it("preserves ungraded original exercises even where answers are not available", () => {
    const items = buildSourceWorkbook(lesson(), original);
    const translationExercise = items.find(q => q.prompt === "1. Xin chào");
    expect(translationExercise).toBeDefined();
    expect(translationExercise?.answer).toBeUndefined();
    expect(items.find(q => q.title === "Nhiệm vụ viết")?.answer).toBeUndefined();
  });
});
