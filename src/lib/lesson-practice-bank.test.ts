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
    const pronunciationQuestions = bank.filter(q => q.id.includes(":pronunciation-"));
    expect(pronunciationQuestions).toHaveLength(2);
    expect(pronunciationQuestions.map(q => q.answer)).toEqual(["한국", "책"]);
    expect(pronunciationQuestions.every(q => q.skill === "speaking")).toBe(true);
    expect(pronunciationQuestions.every(q => q.title.includes("không chấm âm thanh"))).toBe(true);
    expect(pronunciationQuestions.every(q => q.prompt.includes("Hệ thống chỉ chấm phần gõ lại, không chấm âm thanh"))).toBe(true);
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

  it("does not downgrade malformed source choice exercises to input practice", () => {
    const input = lesson(1);
    input.listening = [{
      id: "bad-listening", text: "누구입니까?", meaning: "Ai vậy?",
      choices: ["학생", "선생님"], answer: "의사", sourceRef: "Sách p.24",
    }];
    input.reading!.questions = [{
      id: "bad-reading", q: "누구입니까?", choices: ["학생", "학생"],
      answer: "학생", sourceRef: "Sách p.25",
    }];

    const bank = buildLessonPracticeBank(input, []);
    expect(bank.some(q => q.id === "source-practice:4:listening:0:0")).toBe(false);
    expect(bank.some(q => q.id === "source-practice:4:reading:0:0")).toBe(false);

    // The source workbook retains the original tasks and option arrays for
    // manual review instead of silently repairing the source material.
    const workbook = buildSourceWorkbook(input, []);
    expect(workbook.find(item => item.title === "Bài nghe 1")?.choices)
      .toEqual(["학생", "선생님"]);
    expect(workbook.find(item => item.title === "Đọc hiểu 1")?.choices)
      .toEqual(["학생", "학생"]);
  });

  it("accepts canonically equivalent Hangul choice answers without rewriting source strings", () => {
    const input = lesson(1);
    const decomposed = "가";
    input.listening = [{
      id: "unicode-listening", text: "누구입니까?", meaning: "Ai vậy?",
      choices: ["가", "선생님"], answer: decomposed, sourceRef: "Sách p.24 · listening",
    }];
    input.reading!.questions = [{
      id: "unicode-reading", q: "누구입니까?", choices: ["가", "의사"],
      answer: decomposed, sourceRef: "Sách p.25 · reading",
    }];

    const bank = buildLessonPracticeBank(input, []);
    const listening = bank.find(q => q.id === "source-practice:4:listening:0:0");
    const reading = bank.find(q => q.id === "source-practice:4:reading:0:0");
    expect(listening?.type).toBe("choice");
    expect(listening?.choices).toEqual(["가", "선생님"]);
    expect(listening?.answer).toBe(decomposed);
    expect(reading?.type).toBe("choice");
    expect(reading?.choices).toEqual(["가", "의사"]);
    expect(reading?.answer).toBe(decomposed);
  });

  it("rejects canonically duplicate source choices instead of producing an ambiguous quiz", () => {
    const input = lesson(1);
    input.listening = [{
      id: "unicode-duplicate", text: "누구입니까?", meaning: "Ai vậy?",
      choices: ["가", "가"], answer: "가", sourceRef: "Sách p.24 · duplicate",
    }];

    const bank = buildLessonPracticeBank(input, []);
    expect(bank.some(q => q.id === "source-practice:4:listening:0:0")).toBe(false);
    expect(buildSourceWorkbook(input, []).find(item => item.title === "Bài nghe 1")?.choices)
      .toEqual(["가", "가"]);
  });

  it("keeps genuinely open-ended listening and reading tasks as input", () => {
    const input = lesson(1);
    input.listening = [{
      id: "open-listening", text: "누구입니까?", meaning: "Ai vậy?",
      choices: [], answer: "학생", sourceRef: "Sách p.24",
    }];
    input.reading!.questions = [{
      id: "open-reading", q: "누구입니까?", choices: [],
      answer: "학생", sourceRef: "Sách p.25",
    }];

    const bank = buildLessonPracticeBank(input, []);
    expect(bank.find(q => q.id === "source-practice:4:listening:0:0")?.type).toBe("input");
    expect(bank.find(q => q.id === "source-practice:4:reading:0:0")?.type).toBe("input");
  });

  it("does not manufacture graded answers for untranslated dialogue or open writing", () => {
    const input = lesson(1);
    input.dialogues![0].lines[1].vi = "";
    const bank = buildLessonPracticeBank(input, []);
    expect(bank.filter(q => q.id.includes(":dialogue-"))).toHaveLength(1);
    expect(bank.some(q => q.prompt === input.writing!.prompt && q.answer)).toBe(false);
  });

  it("keeps generated vocabulary choices unambiguous for canonically equivalent Hangul", () => {
    const input = lesson(3);
    input.vocabulary![0] = { ...input.vocabulary![0], ko: "가", vi: "가" };
    input.vocabulary![1] = { ...input.vocabulary![1], ko: "가", vi: "가" };
    input.vocabulary![2] = { ...input.vocabulary![2], ko: "나", vi: "나" };

    const bank = buildLessonPracticeBank(input, []);
    for (const kind of ["vocab-meaning", "vocab-recall"]) {
      for (const index of [0, 1]) {
        const question = bank.find(item => item.id === `source-practice:4:${kind}:${index}:0`);
        expect(question).toBeDefined();
        expect(question?.type).toBe("choice");
        const choices = question?.choices ?? [];
        expect(new Set(choices.map(choice => choice.normalize("NFC"))).size).toBe(choices.length);
        expect(choices).toContain(question?.answer);
      }
    }

    // Comparison is normalized; source answer strings remain unchanged.
    expect(bank.find(item => item.id === "source-practice:4:vocab-meaning:1:0")?.answer).toBe("가");
    expect(bank.find(item => item.id === "source-practice:4:vocab-recall:1:0")?.answer).toBe("가");
  });

  it("rotates answers among distractors rather than keeping every correct option first", () => {
    const bank = buildLessonPracticeBank(lesson(5), []);
    const choicePositions = bank.filter(q => q.id.includes("vocab-meaning"))
      .map(q => q.choices?.indexOf(q.answer));
    expect(new Set(choicePositions).size).toBeGreaterThan(1);
  });
});

describe("full-fidelity source workbook", () => {
  it("keeps recovered textbook sections in their source skills and OCR outside authored practice", () => {
    const input = lesson();
    input.extraSections = [
      { id: "source-writing", kind: "original-writing", title: "Source writing", content: Array.from({ length: 123 }, (_, i) => "Original task " + i), sourceRef: "Synthetic p.1" },
      { id: "source-task", kind: "original-activities", title: "Source tasks", content: ["Source task"], sourceRef: "Synthetic p.2" },
      { id: "source-key", kind: "original-appendix", title: "Source appendix", content: ["Source key"], sourceRef: "Synthetic p.3" },
      { id: "ocr", kind: "source-transcript", title: "OCR pending review", content: ["Unreviewed OCR"], sourceRef: "Synthetic p.4" },
    ];
    const items = buildSourceWorkbook(input, []);
    expect(items.filter(item => item.title.startsWith("Source writing"))).toHaveLength(123);
    expect(items.find(item => item.prompt === "Original task 122")?.category).toBe("Viết");
    expect(items.find(item => item.prompt === "Source task")?.category).toBe("Bài tập gốc");
    expect(items.find(item => item.prompt === "Source key")?.category).toBe("Phụ lục gốc");
    expect(items.find(item => item.prompt === "Unreviewed OCR")?.category).toBe("Nguồn dự phòng · chưa tính là bài biên soạn");
    expect(items.find(item => item.prompt === "Source task")?.answer).toBeUndefined();
  });
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
