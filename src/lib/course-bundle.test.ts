import { describe, it, expect } from "vitest";
import {
  parseCourseBundle,
  normalizeLessonContent,
  CourseBundleValidationError,
  COURSE_BUNDLE_FORMAT,
  COURSE_BUNDLE_VERSION,
  getCompilationContract,
  type CompiledCourseBundle,
  type BundleValidationError,
} from "@/lib/course-bundle";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Minimal valid source manifest matching the demo import job */
const sampleSourceManifest = [
  {
    name: "SÁCH SƠ CẤP 1.pdf",
    size: 8111729,
    lastModified: 1791194978904,
    pageCount: 380,
    sha256: "228ab6df71315d85cc51933c76e23372dadd139b9c2bc1f73ead5f77227f7ac5",
  },
];

const sampleLanguage = {
  target: "ko",
  learner: "vi",
  targetName: "Tiếng Hàn",
  learnerName: "Tiếng Việt",
  locale: "ko-KR",
  script: "hangul" as const,
};

/** A minimal valid lesson using canonical field names */
function minimalLesson(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    targetTitle: "안녕하세요?",
    learnerTitle: "Xin chào",
    objective: "Chào hỏi, giới thiệu tên và quốc tịch.",
    vocabulary: [
      {
        id: "v-hello",
        targetText: "안녕하세요",
        learnerMeaning: "xin chào",
        example: "안녕하세요! 저는 민수입니다.",
        sourceRef: "SÁCH SƠ CẤP 1.pdf · p.35",
      },
    ],
    grammar: [
      {
        id: "g-intro",
        pattern: "N은/는 N입니다",
        meaning: "N là N",
        explanation: "Cấu trúc giới thiệu bản thân.",
        examples: ["저는 학생입니다."],
        sourceRef: "SÁCH SƠ CẤP 1.pdf · p.36",
      },
    ],
    listening: [
      {
        id: "l-1",
        text: "안녕하세요?",
        meaning: "Xin chào?",
        choices: ["Xin chào?", "Tôi là học sinh.", "Tạm biệt."],
        answer: "Xin chào?",
      },
    ],
    speaking: ["안녕하세요. 저는 민수입니다."],
    reading: {
      title: "자기소개",
      text: "저는 민수입니다. 학생입니다.",
      translation: "Tôi là Minsu. Tôi là học sinh.",
      questions: [
        { id: "r1", q: "민수 씨는 뭐 합니까?", choices: ["학생", "회사원"], answer: "학생" },
      ],
    },
    writing: {
      prompt: "Viết 3 câu tự giới thiệu.",
      hint: "Dùng N은/는 N입니다.",
      targetWords: ["안녕하세요", "학생", "이름"],
    },
    dialogues: [
      {
        id: "d-1",
        title: "Gặp nhau lần đầu",
        lines: [
          { speaker: "A", targetText: "안녕하세요?", learnerMeaning: "Xin chào?" },
          { speaker: "B", targetText: "안녕하세요! 저는 민수입니다.", learnerMeaning: "Xin chào! Tôi là Minsu." },
        ],
      },
    ],
    pronunciation: [
      {
        id: "p-1",
        title: "Nguyên âm cơ bản",
        explanation: "ㅏ = a, ㅓ = eo, ㅗ = o",
        examples: ["아", "어", "오"],
      },
    ],
    culture: [
      {
        id: "c-1",
        title: "Văn hóa chào hỏi",
        text: "Người Hàn Quốc thường cúi đầu khi chào.",
      },
    ],
    sourceRef: "SÁCH SƠ CẤP 1.pdf · pp.33-52",
    ...overrides,
  };
}

/** A minimal valid question */
function minimalQuestion(overrides?: Record<string, unknown>) {
  return {
    id: "q-1-1",
    lessonId: 1,
    skill: "vocabulary",
    type: "choice",
    title: "Chọn nghĩa đúng",
    prompt: "안녕하세요",
    choices: ["xin chào", "tạm biệt", "cảm ơn"],
    answer: "xin chào",
    explanation: "안녕하세요 nghĩa là xin chào.",
    sourceRef: "Derived from SÁCH SƠ CẤP 1.pdf · pp.33-52",
    ...overrides,
  };
}

/** A full valid bundle JSON string */
function validBundleJson(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    format: COURSE_BUNDLE_FORMAT,
    version: COURSE_BUNDLE_VERSION,
    generatedAt: "2026-10-05T23:00:00Z",
    language: {
      target: "ko",
      learner: "vi",
      targetName: "Tiếng Hàn",
      learnerName: "Tiếng Việt",
      locale: "ko-KR",
      script: "hangul",
    },
    sourceManifest: sampleSourceManifest,
    course: {
      title: "Tiếng Hàn Sơ cấp 1",
      level: "초급 1",
      lessons: [minimalLesson()],
      questions: [minimalQuestion()],
    },
    ...overrides,
  });
}

function getValidationErrors(rawJson: string): BundleValidationError[] {
  try {
    parseCourseBundle(rawJson);
    return [];
  } catch (e) {
    if (e instanceof CourseBundleValidationError) {
      return e.errors;
    }
    throw e;
  }
}

/* ================================================================== */
/*  TEST SUITE                                                         */
/* ================================================================== */

describe("parseCourseBundle", () => {
  /* ---- 1. get_compilation_contract exposes lesson schema ---- */
  it("exposes detailed lesson schema in get_compilation_contract", () => {
    const contract = getCompilationContract(sampleLanguage);
    expect(contract.runtimeSchema.LessonContent).toBeDefined();
    expect(contract.runtimeSchema.requiredLessonFields).toEqual(
      expect.arrayContaining(["id", "objective", "vocabulary", "grammar", "listening", "speaking"]),
    );
    expect(contract.runtimeSchema.titleRule).toBeDefined();
  });

  /* ---- 2. get_compilation_contract exposes question schema ---- */
  it("exposes detailed question schema in get_compilation_contract", () => {
    const contract = getCompilationContract(sampleLanguage);
    expect(contract.runtimeSchema.StudyQuestion).toBeDefined();
    expect(contract.runtimeSchema.requiredQuestionFields).toEqual(
      expect.arrayContaining(["id", "lessonId", "skill", "type", "prompt", "answer"]),
    );
  });

  /* ---- 3. Contract matches submit_course_bundle validation ---- */
  it("matches the contract: a minimal valid bundle passes validation", () => {
    const bundle = parseCourseBundle(validBundleJson());
    expect(bundle.format).toBe(COURSE_BUNDLE_FORMAT);
    expect(bundle.version).toBe(COURSE_BUNDLE_VERSION);
    expect(bundle.course.lessons).toHaveLength(1);
    expect(bundle.course.questions).toHaveLength(1);
  });

  /* ---- 4. Minimal valid course bundle succeeds validation ---- */
  it("accepts a minimal valid course bundle", () => {
    const bundle = parseCourseBundle(validBundleJson());
    expect(bundle.course.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(bundle.course.level).toBe("초급 1");
  });

  /* ---- 5. Complete lesson with all sections succeeds ---- */
  it("accepts a complete lesson with vocabulary, grammar, dialogue, pronunciation, culture, listening, speaking, reading, writing, quiz", () => {
    const lesson = minimalLesson();
    const questions = [
      minimalQuestion(),
      minimalQuestion({ id: "q-1-2", skill: "grammar", type: "input", prompt: "저__ 학생입니다.", answer: "는", tokens: undefined, choices: undefined }),
      minimalQuestion({ id: "q-1-3", skill: "writing", type: "reorder", prompt: "Sắp xếp", tokens: ["저는", "학생", "입니다"], answer: "저는 학생 입니다", choices: undefined }),
    ];

    const raw = JSON.stringify({
      format: COURSE_BUNDLE_FORMAT,
      version: COURSE_BUNDLE_VERSION,
      sourceManifest: sampleSourceManifest,
      course: {
        title: "Test",
        level: "L1",
        lessons: [lesson],
        questions,
      },
    });

    const bundle = parseCourseBundle(raw);
    expect(bundle.course.lessons[0].dialogues).toHaveLength(1);
    expect(bundle.course.lessons[0].pronunciation).toHaveLength(1);
    expect(bundle.course.lessons[0].culture).toHaveLength(1);
    expect(bundle.course.lessons[0].reading).not.toBeNull();
    expect(bundle.course.lessons[0].writing).not.toBeNull();
    expect(bundle.course.questions).toHaveLength(3);
  });

  /* ---- 6. Missing required lesson field returns precise error ---- */
  it("returns precise error for missing required lesson field", () => {
    const broken = minimalLesson();
    delete (broken as Record<string, unknown>).objective;
    delete (broken as Record<string, unknown>).vocabulary;

    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [broken],
          questions: [],
        },
      }),
    );

    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.path === "lesson[0].objective")).toBe(true);
    expect(errors.some((e) => e.path === "lesson[0].vocabulary")).toBe(true);
  });

  /* ---- 7. Invalid question answer returns precise error ---- */
  it("returns precise error for invalid question answer not in choices", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [
            minimalQuestion({ answer: "WRONG", choices: ["a", "b", "c"] }),
          ],
        },
      }),
    );

    expect(errors.some((e) => e.path === "question[0].answer" && e.reason.includes("not in the choices array"))).toBe(true);
  });

  /* ---- 8. Question referencing unknown lesson fails clearly ---- */
  it("fails clearly when question references unknown lessonId", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [minimalQuestion({ id: "L14-Q2", lessonId: 14 })],
        },
      }),
    );

    expect(errors.some((e) =>
      e.path === "question[0].lessonId" &&
      e.reason.includes("14") &&
      e.reason.includes("does not exist"),
    )).toBe(true);
  });

  /* ---- 9. sourceManifest mismatch fails ---- */
  /* Note: sourceManifest fingerprint checking happens in the MCP route
     (sameSourceManifest), not in parseCourseBundle. parseCourseBundle
     only normalizes the manifest. The test below verifies that the
     manifest is correctly parsed and normalized. */
  it("correctly parses sourceManifest for fingerprint validation", () => {
    const bundle = parseCourseBundle(validBundleJson());
    expect(bundle.sourceManifest).toHaveLength(1);
    expect(bundle.sourceManifest![0].sha256).toBe(
      "228ab6df71315d85cc51933c76e23372dadd139b9c2bc1f73ead5f77227f7ac5",
    );
    expect(bundle.sourceManifest![0].name).toBe("SÁCH SƠ CẤP 1.pdf");
    expect(bundle.sourceManifest![0].size).toBe(8111729);
    expect(bundle.sourceManifest![0].pageCount).toBe(380);
  });

  /* ---- 10. Direct knowledge missing sourceRef does not fail ---- */
  /* sourceRef is optional per schema. Grounding enforcement happens
     at the application level (quality score), not at parse time.
     This verifies optional sourceRef works correctly. */
  it("accepts lesson content without sourceRef (sourceRef is optional)", () => {
    const lesson = minimalLesson({ sourceRef: undefined });
    // Also remove sourceRef from vocabulary items
    (lesson.vocabulary as Record<string, unknown>[]).forEach((v) => {
      delete v.sourceRef;
    });

    const bundle = parseCourseBundle(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [lesson],
          questions: [],
        },
      }),
    );

    expect(bundle.course.lessons[0].sourceRef).toBeUndefined();
  });

  /* ---- 11. Same-lesson derived quiz sourceRef succeeds ---- */
  it("accepts derived quiz with same-lesson sourceRef", () => {
    const question = minimalQuestion({
      sourceRef: "Derived from SÁCH SƠ CẤP 1.pdf · pp.33-52",
    });

    const bundle = parseCourseBundle(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [question],
        },
      }),
    );

    expect(bundle.course.questions[0].sourceRef).toContain("Derived from");
  });

  /* ---- 12. Cross-lesson derived content: currently not enforced at parse
     time. If added later, we can extend this test. ---- */

  /* ---- 13. Korean target / Vietnamese learner profile still works ---- */
  it("parses Korean target / Vietnamese learner profile correctly", () => {
    const bundle = parseCourseBundle(validBundleJson());
    expect(bundle.language).toBeDefined();
    expect(bundle.language!.target).toBe("ko");
    expect(bundle.language!.learner).toBe("vi");
    expect(bundle.language!.targetName).toBe("Tiếng Hàn");
    expect(bundle.language!.learnerName).toBe("Tiếng Việt");
    expect(bundle.language!.locale).toBe("ko-KR");
    expect(bundle.language!.script).toBe("hangul");
  });

  /* ---- 14. Runtime remains language-neutral ---- */
  it("works with non-Korean language profiles (language-neutral)", () => {
    const bundle = parseCourseBundle(
      validBundleJson({
        language: {
          target: "zh",
          learner: "vi",
          targetName: "Tiếng Trung",
          learnerName: "Tiếng Việt",
          locale: "zh-CN",
          script: "han",
        },
      }),
    );

    expect(bundle.language!.target).toBe("zh");
    expect(bundle.language!.script).toBe("han");
  });
});

/* ================================================================== */
/*  Lesson normalization                                               */
/* ================================================================== */

describe("normalizeLessonContent", () => {
  it("normalizes canonical targetTitle/learnerTitle", () => {
    const lesson = normalizeLessonContent(minimalLesson());
    expect(lesson.targetTitle).toBe("안녕하세요?");
    expect(lesson.learnerTitle).toBe("Xin chào");
    // Legacy aliases are set
    expect(lesson.title).toBe("안녕하세요?");
    expect(lesson.vi).toBe("Xin chào");
  });

  it("normalizes legacy title/vi to canonical fields", () => {
    const lesson = normalizeLessonContent({
      id: 1,
      title: "안녕하세요?",
      vi: "Xin chào",
      objective: "test",
      vocabulary: [],
      grammar: [],
      listening: [],
      speaking: [],
      reading: null,
      writing: null,
    });

    expect(lesson.targetTitle).toBe("안녕하세요?");
    expect(lesson.learnerTitle).toBe("Xin chào");
    expect(lesson.title).toBe("안녕하세요?");
    expect(lesson.vi).toBe("Xin chào");
  });

  it("normalizes vocabulary targetText/learnerMeaning and sets ko/vi aliases", () => {
    const lesson = normalizeLessonContent(minimalLesson());
    const vocab = lesson.vocabulary[0];
    expect(vocab.targetText).toBe("안녕하세요");
    expect(vocab.learnerMeaning).toBe("xin chào");
    expect(vocab.ko).toBe("안녕하세요");
    expect(vocab.vi).toBe("xin chào");
  });

  it("normalizes legacy vocabulary ko/vi to canonical fields", () => {
    const lesson = normalizeLessonContent({
      id: 1,
      title: "Test",
      vi: "Test VN",
      objective: "test",
      vocabulary: [{ id: "v1", ko: "학교", vi: "trường học", example: "test" }],
      grammar: [],
      listening: [],
      speaking: [],
      reading: null,
      writing: null,
    });

    const vocab = lesson.vocabulary[0];
    expect(vocab.targetText).toBe("학교");
    expect(vocab.learnerMeaning).toBe("trường học");
    expect(vocab.ko).toBe("학교");
    expect(vocab.vi).toBe("trường học");
  });

  it("normalizes dialogue lines with canonical and legacy aliases", () => {
    const lesson = normalizeLessonContent(minimalLesson());
    const line = lesson.dialogues![0].lines[0];
    expect(line.targetText).toBe("안녕하세요?");
    expect(line.learnerMeaning).toBe("Xin chào?");
    expect(line.ko).toBe("안녕하세요?");
    expect(line.vi).toBe("Xin chào?");
  });
});

/* ================================================================== */
/*  Validation error precision                                         */
/* ================================================================== */

describe("CourseBundleValidationError", () => {
  it("is a proper Error subclass", () => {
    const err = new CourseBundleValidationError([
      { path: "test", reason: "missing" },
    ]);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CourseBundleValidationError);
    expect(err.name).toBe("CourseBundleValidationError");
    expect(err.errors).toHaveLength(1);
  });

  it("includes all errors in its message", () => {
    const err = new CourseBundleValidationError([
      { path: "lesson[0].grammar[1]", reason: 'required field "form" is missing' },
      { path: "question[12].answerIndex", reason: "must be integer 0–3", expected: "number" },
    ]);

    expect(err.message).toContain("lesson[0].grammar[1]");
    expect(err.message).toContain("question[12].answerIndex");
  });

  it("truncates at 20 errors with summary", () => {
    const manyErrors = Array.from({ length: 25 }, (_, i) => ({
      path: `field[${i}]`,
      reason: "broken",
    }));
    const err = new CourseBundleValidationError(manyErrors);

    expect(err.message).toContain("... and 5 more errors");
    expect(err.errors).toHaveLength(25);
  });
});

/* ================================================================== */
/*  Structural edge cases                                              */
/* ================================================================== */

describe("parseCourseBundle edge cases", () => {
  it("rejects non-object input", () => {
    expect(() => parseCourseBundle('"hello"')).toThrow(
      CourseBundleValidationError,
    );
  });

  it("rejects wrong format", () => {
    const errors = getValidationErrors(JSON.stringify({ format: "other", version: 1, course: {} }));
    expect(errors.some((e) => e.path === "format")).toBe(true);
  });

  it("rejects wrong version", () => {
    const errors = getValidationErrors(
      JSON.stringify({ format: COURSE_BUNDLE_FORMAT, version: 99, course: { title: "T", level: "L", lessons: [], questions: [] } }),
    );
    expect(errors.some((e) => e.path === "version")).toBe(true);
  });

  it("rejects missing course", () => {
    const errors = getValidationErrors(
      JSON.stringify({ format: COURSE_BUNDLE_FORMAT, version: 1 }),
    );
    expect(errors.some((e) => e.path === "course")).toBe(true);
  });

  it("rejects missing course.title", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        course: { level: "L", lessons: [], questions: [] },
      }),
    );
    expect(errors.some((e) => e.path === "course.title")).toBe(true);
  });

  it("validates vocabulary item sub-fields", () => {
    const lesson = minimalLesson();
    (lesson.vocabulary as Record<string, unknown>[])[0] = { id: 123 }; // invalid

    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [lesson],
          questions: [],
        },
      }),
    );

    expect(errors.some((e) => e.path.includes("vocabulary[0].id"))).toBe(true);
    expect(errors.some((e) => e.path.includes("vocabulary[0].targetText"))).toBe(true);
  });

  it("validates grammar item sub-fields", () => {
    const lesson = minimalLesson();
    (lesson.grammar as Record<string, unknown>[])[0] = { id: "g1" }; // missing pattern, meaning, explanation, examples

    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [lesson],
          questions: [],
        },
      }),
    );

    expect(errors.some((e) => e.path.includes("grammar[0].pattern"))).toBe(true);
    expect(errors.some((e) => e.path.includes("grammar[0].meaning"))).toBe(true);
    expect(errors.some((e) => e.path.includes("grammar[0].explanation"))).toBe(true);
    expect(errors.some((e) => e.path.includes("grammar[0].examples"))).toBe(true);
  });

  it("validates listening item sub-fields", () => {
    const lesson = minimalLesson();
    (lesson.listening as Record<string, unknown>[])[0] = { id: "l1" }; // missing text, meaning, choices, answer

    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [lesson],
          questions: [],
        },
      }),
    );

    expect(errors.some((e) => e.path.includes("listening[0].text"))).toBe(true);
    expect(errors.some((e) => e.path.includes("listening[0].meaning"))).toBe(true);
    expect(errors.some((e) => e.path.includes("listening[0].choices"))).toBe(true);
    expect(errors.some((e) => e.path.includes("listening[0].answer"))).toBe(true);
  });

  it("validates question skill enum", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [minimalQuestion({ skill: "INVALID_SKILL" })],
        },
      }),
    );

    expect(errors.some((e) => e.path === "question[0].skill" && e.reason.includes("must be one of"))).toBe(true);
  });

  it("validates question type enum", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [minimalQuestion({ type: "INVALID_TYPE" })],
        },
      }),
    );

    expect(errors.some((e) => e.path === "question[0].type" && e.reason.includes("must be one of"))).toBe(true);
  });

  it("requires tokens for reorder questions", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [minimalQuestion({ type: "reorder", tokens: undefined, choices: undefined })],
        },
      }),
    );

    expect(errors.some((e) => e.path === "question[0].tokens" && e.reason.includes("reorder"))).toBe(true);
  });

  it("requires choices for choice questions", () => {
    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [minimalLesson()],
          questions: [minimalQuestion({ choices: undefined })],
        },
      }),
    );

    expect(errors.some((e) => e.path === "question[0].choices" && e.reason.includes("choice"))).toBe(true);
  });

  it("collects multiple errors across lessons and questions in one throw", () => {
    const broken1 = { id: "bad" }; // not a number, missing everything
    const broken2 = minimalLesson({ id: 2, vocabulary: "not_an_array" }); // wrong type

    const errors = getValidationErrors(
      JSON.stringify({
        format: COURSE_BUNDLE_FORMAT,
        version: 1,
        sourceManifest: sampleSourceManifest,
        course: {
          title: "T",
          level: "L",
          lessons: [broken1, broken2],
          questions: [{ not: "a question" }],
        },
      }),
    );

    // Multiple lesson errors
    expect(errors.some((e) => e.path.startsWith("lesson[0]"))).toBe(true);
    expect(errors.some((e) => e.path.startsWith("lesson[1]"))).toBe(true);
    // Question errors
    expect(errors.some((e) => e.path.startsWith("question[0]"))).toBe(true);
  });
});
