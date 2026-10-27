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
      example: "예문 " + i, sourceRef: "Sách p.22 · v" + i, exampleSourceRef: "Sách p.22 · v" + i + " · example",
    })),
    grammar: [{
      id: "g1", pattern: "-입니다", meaning: "là", explanation: "Lối nói trang trọng",
      examples: ["저는 학생입니다.", "여기는 학교입니다."], sourceRef: "Sách p.23 · g1",
      exampleSourceRefs: ["Sách p.23 · g1 · example-0", "Sách p.23 · g1 · example-1"],
    }],
    listening: [{
      id: "l1", text: "누구입니까?", meaning: "Ai vậy?",
      choices: ["학생", "선생님"], answer: "학생", sourceRef: "Sách p.24 · listening-1",
    }],
    speaking: ["안녕하세요.", "감사합니다."],
    speakingSourceRefs: ["Sách p.24 · speaking-0", "Sách p.24 · speaking-1"],
    reading: {
      title: "읽기", text: "저는 학생입니다.", translation: "Tôi là học sinh.",
      questions: [{ id: "r1", q: "누구입니까?", choices: ["학생", "의사"], answer: "학생", sourceRef: "Sách p.25 · reading-question-1" }],
      sourceRef: "Sách p.25 · reading-passage",
    },
    writing: { prompt: "Viết giới thiệu", hint: "Dùng -입니다", targetWords: ["저", "학생"], sourceRef: "Sách p.26 · writing", targetWordSourceRefs: ["Sách p.26 · target-0", "Sách p.26 · target-1"] },
    dialogues: [{
      id: "d1", title: "대화", sourceRef: "Sách p.27",
      lines: [
        { speaker: "A", ko: "안녕하세요.", vi: "Xin chào.", sourceRef: "Sách p.27 · dialogue-line-0" },
        { speaker: "B", ko: "반갑습니다.", vi: "Rất vui được gặp.", sourceRef: "Sách p.27 · dialogue-line-1" },
      ],
    }],
    pronunciation: [{
      id: "p1", title: "받침", explanation: "Luyện patchim",
      examples: ["한국", "책"], sourceRef: "Sách p.28 · pronunciation",
      exampleSourceRefs: ["Sách p.28 · pronunciation-example-0", "Sách p.28 · pronunciation-example-1"],
    }],
    culture: [{ id: "c1", title: "Văn hoá", text: "Chào hỏi", sourceRef: "Sách p.29 · culture" }],
    extraSections: [{
      id: "ex1", kind: "Bài tập", title: "Dịch", content: ["1. Xin chào", "2. Tôi là học sinh"], sourceRef: "Sách p.30", contentSourceRefs: ["Sách p.30 · exercise-0", "Sách p.30 · exercise-1"],
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
    const targetWordDrill = bank.find(q => q.id.includes(":writing-word:0:"));
    expect(targetWordDrill).toMatchObject({ prompt: "Gõ lại từ khóa bài viết: 저", answer: "저" });
    expect(targetWordDrill?.prompt).not.toContain("tự đặt câu");
  });

  it("uses exact item-level refs for nested practice and never inherits section refs", () => {
    const input = lesson(1);
    const bank = buildLessonPracticeBank(input, []);
    const find = (fragment: string) => bank.find(q => q.id.includes(fragment));
    expect(find(":vocab-example:")?.sourceRef).toBe("Sách p.22 · v0 · example");
    expect(find(":grammar-example-0:")?.sourceRef).toBe("Sách p.23 · g1 · example-0");
    expect(find(":speaking:0:")?.sourceRef).toBe("Sách p.24 · speaking-0");
    expect(find(":pronunciation-0:")?.sourceRef).toBe("Sách p.28 · pronunciation-example-0");
    expect(find(":writing-word:0:")?.sourceRef).toBe("Sách p.26 · target-0");
    expect(find(":vocab-meaning:")?.sourceRef).toBe("Sách p.22 · v0");
    expect(find(":grammar-pattern:")?.sourceRef).toBe("Sách p.23 · g1");
    expect(find(":listening:")?.sourceRef).toBe("Sách p.24 · listening-1");
    expect(find(":reading:")?.sourceRef).toBe("Sách p.25 · reading-question-1");
    expect(find(":dialogue-0:0:")?.sourceRef).toBe("Sách p.27 · dialogue-line-0");

    const legacy = lesson(1);
    delete legacy.vocabulary[0].sourceRef;
    delete legacy.vocabulary[0].exampleSourceRef;
    delete legacy.grammar[0].sourceRef;
    delete legacy.grammar[0].exampleSourceRefs;
    delete legacy.listening[0].sourceRef;
    delete legacy.reading!.questions[0].sourceRef;
    delete legacy.dialogues![0].lines[0].sourceRef;
    delete legacy.dialogues![0].lines[1].sourceRef;
    delete legacy.speakingSourceRefs;
    delete legacy.pronunciation![0].exampleSourceRefs;
    delete legacy.writing!.targetWordSourceRefs;
    const legacyBank = buildLessonPracticeBank(legacy, []);
    expect(legacyBank.find(q => q.id.includes(":vocab-example:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":grammar-example-0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":speaking:0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":pronunciation-0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":writing-word:0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":vocab-meaning:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":grammar-pattern:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":listening:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":reading:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":dialogue-0:0:"))?.sourceRef).toBeUndefined();
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
