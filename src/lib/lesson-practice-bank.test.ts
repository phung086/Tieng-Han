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

    const legacy = lesson(1);
    delete legacy.vocabulary[0].exampleSourceRef;
    delete legacy.grammar[0].exampleSourceRefs;
    delete legacy.speakingSourceRefs;
    delete legacy.pronunciation![0].exampleSourceRefs;
    delete legacy.writing!.targetWordSourceRefs;
    const legacyBank = buildLessonPracticeBank(legacy, []);
    expect(legacyBank.find(q => q.id.includes(":vocab-example:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":grammar-example-0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":speaking:0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":pronunciation-0:"))?.sourceRef).toBeUndefined();
    expect(legacyBank.find(q => q.id.includes(":writing-word:0:"))?.sourceRef).toBeUndefined();
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
    expect(count("Viết")).toBe(3);
    expect(items.find(q => q.title === "Từ mục tiêu viết 1")?.sourceRef).toBe("Sách p.26 · target-0");
    expect(items.find(q => q.title === "Từ mục tiêu viết 2")?.sourceRef).toBe("Sách p.26 · target-1");
    expect(count("Hội thoại")).toBe(2);
    expect(count("Phát âm")).toBe(3);
    expect(count("Văn hóa")).toBe(1);
    expect(count("Bài tập bổ sung")).toBe(2);
    expect(count("Câu hỏi đã nhập")).toBe(1);
    expect(new Set(items.map(q => q.id)).size).toBe(items.length);
    expect(items.find(q => q.prompt === "2. Tôi là học sinh")?.sourceRef).toBe("Sách p.30 · exercise-1");
    expect(items.find(q => q.title === "Câu ví dụ 1")?.sourceRef).toBe("Sách p.22 · v0 · example");
    expect(items.find(q => q.title === "Câu mẫu 1.1")?.sourceRef).toBe("Sách p.23 · g1 · example-0");
    expect(items.find(q => q.title === "Lượt nói 1")?.sourceRef).toBe("Sách p.24 · speaking-0");
  });


  it("never inherits a parent or section reference for an unreferenced source item", () => {
    const input = lesson(1);
    delete input.vocabulary[0].exampleSourceRef;
    delete input.grammar[0].exampleSourceRefs;
    delete input.speakingSourceRefs;
    delete input.reading!.questions[0].sourceRef;
    delete input.dialogues![0].lines[0].sourceRef;
    delete input.pronunciation![0].exampleSourceRefs;
    delete input.writing!.targetWordSourceRefs;
    delete input.extraSections![0].contentSourceRefs;

    const items = buildSourceWorkbook(input, []);
    const byPrompt = (prompt: string) => items.find(item => item.prompt === prompt);
    expect(byPrompt("단어0")?.sourceRef).toBe("Sách p.22 · v0");
    expect(byPrompt("예문 0")?.sourceRef).toBeUndefined();
    expect(byPrompt("-입니다")?.sourceRef).toBe("Sách p.23 · g1");
    expect(byPrompt("저는 학생입니다.")?.sourceRef).toBeUndefined();
    expect(items.find(item => item.title === "Lượt nói 1")?.sourceRef).toBeUndefined();
    expect(items.find(item => item.title === "Đọc hiểu 1")?.sourceRef).toBeUndefined();
    expect(items.find(item => item.title === "대화 · A")?.sourceRef).toBeUndefined();
    expect(items.find(item => item.title === "받침 · Ví dụ 1")?.sourceRef).toBeUndefined();
    expect(items.find(item => item.title === "Từ mục tiêu viết 1")?.sourceRef).toBeUndefined();
    expect(byPrompt("1. Xin chào")?.sourceRef).toBeUndefined();
  });

  it("preserves ungraded original exercises even where answers are not available", () => {
    const items = buildSourceWorkbook(lesson(), original);
    const translationExercise = items.find(q => q.prompt === "1. Xin chào");
    expect(translationExercise).toBeDefined();
    expect(translationExercise?.answer).toBeUndefined();
    expect(items.find(q => q.title === "Nhiệm vụ viết")?.answer).toBeUndefined();
  });

  it("preserves typed original exercise motifs and only reveals source-backed answer keys", () => {
    const input = lesson(1);
    const sourceContent = [
      "Chọn đáp án đúng: 누구입니까?",
      "Điền từ còn thiếu: 저는 ___입니다.",
      "Sắp xếp thành câu: 저는 / 학생입니다",
      "Nối cột A và B.",
      "Dịch sang tiếng Hàn: Xin chào.",
      "Đóng vai A và B.",
      "Viết một đoạn giới thiệu.",
      "Bài tập cần kiểm tra lại PDF.",
    ];
    input.extraSections = [{
      id: "typed-exercises",
      kind: "original-activities",
      title: "Bài tập gốc",
      content: sourceContent,
      contentSourceRefs: sourceContent.map((_, index) => "Sách p.40 · exercise-" + index),
      contentExerciseItems: [
        { id: "choice-1", contentIndex: 0, type: "choice", choices: ["학생", "의사"], answer: "학생" },
        { id: "blank-1", contentIndex: 1, type: "fill-blank", answer: "학생" },
        { id: "reorder-1", contentIndex: 2, type: "reorder", tokens: ["저는", "학생입니다"], answer: "저는 학생입니다." },
        { id: "matching-1", contentIndex: 3, type: "matching", leftItems: ["A"], rightItems: ["가"], answerPairs: [{ left: "A", right: "가" }] },
        { id: "translation-1", contentIndex: 4, type: "translation", answer: "안녕하세요" },
        { id: "role-play-1", contentIndex: 5, type: "role-play", hint: "Giữ nguyên vai A/B" },
        { id: "writing-1", contentIndex: 6, type: "extended-writing" },
        { id: "manual-1", contentIndex: 7, type: "manual" },
      ],
    }];

    const items = buildSourceWorkbook(input, []);
    const at = (index: number) => items.find(item => item.id === "source:4:extra-0:" + index + ":0");
    expect(at(0)).toMatchObject({ prompt: sourceContent[0], exerciseType: "choice", choices: ["학생", "의사"], answer: "학생", sourceRef: "Sách p.40 · exercise-0" });
    expect(at(1)).toMatchObject({ exerciseType: "fill-blank", answer: "학생" });
    expect(at(2)).toMatchObject({ exerciseType: "reorder", tokens: ["저는", "학생입니다"], answer: "저는 학생입니다." });
    expect(at(3)).toMatchObject({ exerciseType: "matching", leftItems: ["A"], rightItems: ["가"], answer: "A → 가" });
    expect(at(4)).toMatchObject({ exerciseType: "translation", answer: "안녕하세요" });
    expect(at(5)).toMatchObject({ exerciseType: "role-play" });
    expect(at(5)?.answer).toBeUndefined();
    expect(at(5)?.hint).toContain("Giữ nguyên vai A/B");
    expect(at(6)).toMatchObject({ exerciseType: "extended-writing" });
    expect(at(7)).toMatchObject({ exerciseType: "manual" });
    expect(sourceContent.every((prompt, index) => at(index)?.prompt === prompt)).toBe(true);

    // A malformed choice key must not be exposed as a valid answer.
    input.extraSections![0].contentExerciseItems![0].answer = "선생님";
    const malformed = buildSourceWorkbook(input, []);
    expect(malformed.find(item => item.id === "source:4:extra-0:0:0")?.choices).toEqual(["학생", "의사"]);
    expect(malformed.find(item => item.id === "source:4:extra-0:0:0")?.answer).toBeUndefined();

    input.extraSections![0].contentExerciseItems![3].answerPairs![0].right = "의사";
    const badMatching = buildSourceWorkbook(input, []);
    expect(badMatching.find(item => item.id === "source:4:extra-0:3:0")?.answer).toBeUndefined();
  });

  it("withholds matching answers when pairs are incomplete or ambiguous", () => {
    const input = lesson(1);
    input.extraSections = [{
      id: "ambiguous-matching",
      kind: "original-activities",
      title: "Nối cột",
      content: ["Duplicate left", "Missing left", "Duplicate right"],
      contentSourceRefs: ["Sách p.42 · match-1", "Sách p.42 · match-2", "Sách p.42 · match-3"],
      contentExerciseItems: [
        {
          id: "duplicate-left",
          contentIndex: 0,
          type: "matching",
          leftItems: ["A", "B"],
          rightItems: ["가", "나"],
          answerPairs: [{ left: "A", right: "가" }, { left: "A", right: "나" }],
        },
        {
          id: "missing-left",
          contentIndex: 1,
          type: "matching",
          leftItems: ["A", "B"],
          rightItems: ["가", "나"],
          answerPairs: [{ left: "A", right: "가" }],
        },
        {
          id: "duplicate-right",
          contentIndex: 2,
          type: "matching",
          leftItems: ["A", "B"],
          rightItems: ["가", "나"],
          answerPairs: [{ left: "A", right: "가" }, { left: "B", right: "가" }],
        },
      ],
    }];

    const items = buildSourceWorkbook(input, []);
    expect(items.find(item => item.prompt === "Duplicate left")?.answer).toBeUndefined();
    expect(items.find(item => item.prompt === "Missing left")?.answer).toBeUndefined();
    expect(items.find(item => item.prompt === "Duplicate right")?.answer).toBeUndefined();
  });

  it("compares canonically equivalent matching labels without rewriting source text", () => {
    const input = lesson(1);
    input.extraSections = [{
      id: "unicode-matching",
      kind: "original-activities",
      title: "Nối cột",
      content: ["Unicode-normalized labels"],
      contentSourceRefs: ["Sách p.43 · matching-1"],
      contentExerciseItems: [{
        id: "unicode-matching-1",
        contentIndex: 0,
        type: "matching",
        leftItems: ["가"],
        rightItems: ["나"],
        answerPairs: [{ left: "\u1100\u1161", right: "나" }],
      }],
    }];

    const item = buildSourceWorkbook(input, []).find(item => item.prompt === "Unicode-normalized labels");
    expect(item?.answer).toBe("\u1100\u1161 → 나");
  });

  it("compares canonically equivalent choice answers without rewriting source text", () => {
    const input = lesson(1);
    input.extraSections = [{
      id: "unicode-choice",
      kind: "original-activities",
      title: "Chọn đáp án",
      content: ["Unicode-normalized choice answer"],
      contentSourceRefs: ["Sách p.44 · choice-1"],
      contentExerciseItems: [{
        id: "unicode-choice-1",
        contentIndex: 0,
        type: "choice",
        choices: ["가", "나"],
        answer: "\u1100\u1161",
      }],
    }];

    const item = buildSourceWorkbook(input, []).find(item => item.prompt === "Unicode-normalized choice answer");
    expect(item?.answer).toBe("\u1100\u1161");
    expect(item?.choices).toEqual(["가", "나"]);
  });

  it("reveals a source reorder answer only when available token chunks can construct it", () => {
    const input = lesson(1);
    input.extraSections = [{
      id: "reorder-source",
      kind: "original-activities",
      title: "Sắp xếp câu",
      content: ["Sắp xếp các cụm từ thành câu."],
      contentSourceRefs: ["Sách p.41 · reorder-1"],
      contentExerciseItems: [{
        id: "reorder-source-1",
        contentIndex: 0,
        type: "reorder",
        tokens: ["학생입니다", "저는", "선생님입니다"],
        answer: "저는 학생입니다.",
      }],
    }];

    const getItem = () => buildSourceWorkbook(input, []).find(item => item.exerciseType === "reorder");
    expect(getItem()?.answer).toBe("저는 학생입니다.");

    input.extraSections![0].contentExerciseItems![0].answer = "저는 의사입니다.";
    expect(getItem()?.answer).toBeUndefined();

    // A token chunk may be used only as many times as it appears in the source bank.
    input.extraSections![0].contentExerciseItems![0].answer = "저는 학생입니다 학생입니다.";
    expect(getItem()?.answer).toBeUndefined();
  });
    // Canonically equivalent Korean syllables must match, while the displayed answer stays verbatim.
  it("normalizes Unicode when validating source reorder tokens", () => {
    const input = lesson(1);
    input.extraSections = [{
      id: "reorder-unicode",
      kind: "original-activities",
      title: "Sắp xếp câu",
      content: ["Ghép các cụm thành câu."],
      contentSourceRefs: ["Sách p.45 · reorder-unicode-1"],
      contentExerciseItems: [{
        id: "reorder-unicode-1",
        contentIndex: 0,
        type: "reorder",
        tokens: ["\\u1100\\u1161", "나"],
        answer: "가 나.",
      }],
    }];

    const item = buildSourceWorkbook(input, []).find(item => item.exerciseType === "reorder");
    expect(item?.answer).toBe("가 나.");
    expect(item?.tokens).toEqual(["\\u1100\\u1161", "나"]);
  });
});
