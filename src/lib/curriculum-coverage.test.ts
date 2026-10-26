import { describe, expect, it } from "vitest";
import { auditCurriculumCoverage, type SourceInventory } from "@/lib/curriculum-coverage";
import type { CompiledCourseBundle } from "@/lib/course-bundle";
import { parseCourseBundle } from "@/lib/course-bundle";

function fixture(): CompiledCourseBundle {
  return parseCourseBundle(JSON.stringify({ format: "haneul-course-bundle", version: 1,
    sourceManifest: [{ name: "synthetic.pdf", size: 1, lastModified: 1, pageCount: 2, sha256: "a".repeat(64) }],
    course: { title: "Test", level: "L1", lessons: [{ id: 1, title: "학생", vi: "Học sinh", objective: "Fixture",
      vocabulary: [{ id: "v1", ko: "학생", vi: "học sinh", example: "", sourceRef: "synthetic.pdf · p.1 · v1" }],
      grammar: [], listening: [], speaking: [], reading: null, writing: null,
      extraSections: [{ id: "exercise", kind: "exercise", title: "Viết tự do", content: ["Viết một câu tự giới thiệu."], sourceRef: "synthetic.pdf · p.2 · exercise" }],
    }], questions: [{ id: "q1", lessonId: 1, skill: "vocabulary", type: "input", title: "Fixture", prompt: "học sinh", answer: "학생", explanation: "Fixture", sourceRef: "synthetic.pdf · p.1 · v1", origin: "derived" }] } }));
}
function inventory(): SourceInventory {
  return { version: 1, pages: [1, 2].map(pageNumber => ({ fileName: "synthetic.pdf", pageNumber, status: "reviewed", classification: "learning-content" })), items: [
    { id: "v1", lessonId: 1, kind: "vocabulary", fileName: "synthetic.pdf", pageNumber: 1,
      sourceRef: "synthetic.pdf · p.1 · v1", contentPointer: "/vocabulary/0", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q1"], verified: true },
    { id: "exercise", lessonId: 1, kind: "exerciseSection", fileName: "synthetic.pdf", pageNumber: 2,
      sourceRef: "synthetic.pdf · p.2 · exercise", contentPointer: "/extraSections/0", practiceMethod: "workbook", practiceQuestionIds: [], verified: true },
  ] };
}
describe("source, practice and validation coverage are independent release evidence", () => {
  it("refuses an unchecked page inventory even if the author claims every page was reviewed", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items.pop();
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("partial");
    expect(report.sourceCoverage.percent).toBeNull();
    expect(report.issues.join(" ")).toContain("Trang chưa có kiểm kê");
  });
  it("requires a reason to exclude a non-learning page and never counts raw transcripts as authoring", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items.pop();
    bundle.sourceInventory.pages[1].classification = "non-learning";
    expect(auditCurriculumCoverage(bundle).status).toBe("partial");
    bundle.sourceInventory.pages[1].reason = "Blank reverse cover, independently reviewed";
    expect(auditCurriculumCoverage(bundle).status).toBe("complete");
    bundle.course.lessons[0].extraSections![0].kind = "source-transcript";
    bundle.sourceInventory = inventory();
    expect(auditCurriculumCoverage(bundle).sourceCoverage.covered).toBe(1);
    expect(auditCurriculumCoverage(bundle).status).toBe("partial");
  });
  it("never substitutes quiz quantity or self-reported quality for missing inventory", () => {
    const bundle = fixture();
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("unverified");
    expect(report.sourceCoverage.percent).toBeNull();
    expect(report.derivedContent).toBe(1);
  });
  it("reconciles all source pages, content pointers, answers and manual original exercises", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("complete");
    expect(report.sourceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
    expect(report.practiceCoverage.percent).toBe(100);
    expect(report.validationCoverage.percent).toBe(100);
    expect(parseCourseBundle(JSON.stringify(bundle)).sourceInventory).toEqual(bundle.sourceInventory);
  });
  it("flags missing or unavailable pages even when content item counts match", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.pages[1] = { fileName: "synthetic.pdf", pageNumber: 2, status: "unavailable", reason: "scan unreadable" };
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("partial");
    expect(report.sourceCoverage.percent).toBeNull();
    expect(report.validationCoverage.percent).toBe(50);
    expect(report.issues.join(" ")).toContain("scan unreadable");
  });
  it("does not count dangling or cross-lesson question links", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items = [bundle.sourceInventory.items[0]];
    bundle.sourceInventory.items[0].practiceQuestionIds = ["not-a-question"];
    expect(auditCurriculumCoverage(bundle).practiceCoverage).toEqual({ covered: 0, total: 1, percent: 0 });
    bundle.course.questions[0].lessonId = 2;
    bundle.sourceInventory.items[0].practiceQuestionIds = ["q1"];
    expect(auditCurriculumCoverage(bundle).practiceCoverage).toEqual({ covered: 0, total: 1, percent: 0 });
  });
  it("does not treat vocabulary content as a workbook exercise", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items = [{
      ...bundle.sourceInventory.items[0], practiceMethod: "workbook", practiceQuestionIds: [],
    }];
    const report = auditCurriculumCoverage(bundle);
    expect(report.practiceCoverage).toEqual({ covered: 0, total: 1, percent: 0 });
    expect(report.issues.join(" ")).toContain("Thiếu phương thức ôn luyện");
  });
  it("requires a valid explicit exercise target when workbook questions are not linked", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items = [{
      ...bundle.sourceInventory.items[1], practiceQuestionIds: ["not-a-question"],
    }];
    expect(auditCurriculumCoverage(bundle).practiceCoverage).toEqual({ covered: 0, total: 1, percent: 0 });
    bundle.sourceInventory.items[0].practiceQuestionIds = [];
    expect(auditCurriculumCoverage(bundle).practiceCoverage).toEqual({ covered: 1, total: 1, percent: 100 });
  });
  it("rejects an inventory ref that matches the filename but not the referenced item", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].vocabulary[0].sourceRef = "synthetic.pdf · p.1 · different-item";
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("sourceRef inventory không khớp");
  });

  it("rejects a filename that appears only as another filename's suffix", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const wrongRef = "other-synthetic.pdf · p.1 · v1";
    bundle.course.lessons[0].vocabulary[0].sourceRef = wrongRef;
    bundle.sourceInventory.items[0].sourceRef = wrongRef;

    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(1);
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("Tên tệp trong sourceRef không khớp chính xác");
  });
  it("requires an item-level reference for nested grammar examples", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].grammar = [{
      id: "g1", pattern: "N입니다", meaning: "là N", explanation: "Fixture",
      examples: ["저는 학생입니다."], sourceRef: "synthetic.pdf · p.1 · grammar",
    }];
    bundle.course.questions[0].sourceRef = "synthetic.pdf · p.1 · grammar-example";
    bundle.sourceInventory.items[0] = {
      ...bundle.sourceInventory.items[0], id: "grammar-example", kind: "grammar-example",
      sourceRef: "synthetic.pdf · p.1 · grammar-example", contentPointer: "/grammar/0/examples/0",
    };
    expect(auditCurriculumCoverage(bundle).sourceCoverage.covered).toBe(1);
    bundle.course.lessons[0].grammar[0].exampleSourceRefs = ["synthetic.pdf · p.1 · grammar-example"];
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(2);
    expect(report.practiceCoverage.covered).toBe(2);
    expect(report.status).toBe("complete");
  });
  it("requires per-prompt refs for speaking and rejects misaligned ref arrays", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].speaking = ["안녕하세요."];
    bundle.course.questions[0].sourceRef = "synthetic.pdf · p.1 · speaking-1";
    bundle.sourceInventory.items[0] = {
      ...bundle.sourceInventory.items[0], id: "speaking-1", kind: "speaking",
      sourceRef: "synthetic.pdf · p.1 · speaking-1", contentPointer: "/speaking/0",
    };
    expect(auditCurriculumCoverage(bundle).sourceCoverage.covered).toBe(1);
    bundle.course.lessons[0].speakingSourceRefs = ["synthetic.pdf · p.1 · speaking-1", "synthetic.pdf · p.1 · extra"];
    expect(auditCurriculumCoverage(bundle).issues.join(" ")).toContain("Mảng tham chiếu item không khớp");
    bundle.course.lessons[0].speakingSourceRefs = ["synthetic.pdf · p.1 · speaking-1"];
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(2);
    expect(report.practiceCoverage.covered).toBe(2);
    expect(report.status).toBe("complete");
  });
  it("rejects duplicate IDs, unknown sources and unsafe or missing content destinations", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items.push({ ...bundle.sourceInventory.items[0] });
    bundle.sourceInventory.items[0].contentPointer = "/__proto__/constructor";
    bundle.sourceInventory.items[1].fileName = "other.pdf";
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("blocked");
    expect(report.sourceCoverage.covered).toBe(0);
    expect(report.issues.join(" ")).toContain("Trùng source item");
  });
  it("requires a declared practice motif to match a linked question", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items[0].motif = "reorder";
    const mismatched = auditCurriculumCoverage(bundle);
    expect(mismatched.status).toBe("partial");
    expect(mismatched.practiceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(mismatched.issues.join(" ")).toContain("Sai motif luyện tập");

    bundle.course.questions[0].type = "reorder";
    const matched = auditCurriculumCoverage(bundle);
    expect(matched.status).toBe("complete");
    expect(matched.practiceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
  });

  it("requires a motif for question-based items but preserves reviewed manual workbook tasks", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    delete bundle.sourceInventory.items[0].motif;

    const missing = auditCurriculumCoverage(bundle);
    expect(missing.status).toBe("partial");
    expect(missing.practiceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(missing.issues.join(" ")).toContain("Thiếu motif luyện tập cho item 1:v1");
    expect(missing.issues.join(" ")).not.toContain("Thiếu motif luyện tập cho item 1:exercise");

    bundle.sourceInventory.items[0].motif = "input";
    const declared = auditCurriculumCoverage(bundle);
    expect(declared.status).toBe("complete");
    expect(declared.practiceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
  });

  it("does not let a manual workbook task bypass a declared motif without a linked matching question", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items[1].motif = "choice";

    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("partial");
    expect(report.practiceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(report.issues.join(" ")).toContain("Sai motif luyện tập cho item 1:exercise");
  });

  it("normalizes the documented Derived from prefix before matching practice refs", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.questions[0].sourceRef = "Derived from synthetic.pdf · p.1 · v1";
    const report = auditCurriculumCoverage(bundle);
    expect(report.practiceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
    expect(report.status).toBe("complete");
  });


  it("does not count a vocabulary record without its target word as represented or practiced", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].vocabulary[0].ko = "";
    bundle.course.lessons[0].vocabulary[0].targetText = "";

    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(report.practiceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("Thiếu nội dung hoặc nguồn cho item 1:v1");
  });

  it("rejects an inventory kind that points to a different content family", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].grammar = [{
      id: "g1", pattern: "N입니다", meaning: "is N", explanation: "Fixture",
      examples: [], sourceRef: "synthetic.pdf · p.1 · v1",
    }];
    bundle.sourceInventory.items[0].contentPointer = "/grammar/0";
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(1);
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");
  });

  it("keeps grammar-section and grammar-pattern inventory kinds distinct", () => {
    const sectionBundle = fixture(); sectionBundle.sourceInventory = inventory();
    const sectionRef = "synthetic.pdf · p.1 · grammar-section";
    sectionBundle.course.lessons[0].vocabulary = [];
    sectionBundle.course.lessons[0].grammar = [{
      id: "g1", pattern: "N입니다", meaning: "is N", explanation: "Fixture",
      examples: [], sourceRef: sectionRef,
    }];
    sectionBundle.course.questions[0].sourceRef = sectionRef;
    sectionBundle.sourceInventory.items[0] = {
      ...sectionBundle.sourceInventory.items[0], id: "grammar-pattern-as-section",
      kind: "grammarpattern", sourceRef: sectionRef, contentPointer: "/grammar/0",
      practiceQuestionIds: ["q1"],
    };
    const sectionReport = auditCurriculumCoverage(sectionBundle);
    expect(sectionReport.status).toBe("partial");
    expect(sectionReport.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");

    const patternBundle = fixture(); patternBundle.sourceInventory = inventory();
    const patternRef = "synthetic.pdf · p.1 · grammar-pattern";
    patternBundle.course.lessons[0].vocabulary = [];
    patternBundle.course.lessons[0].grammar = [{
      id: "g1", pattern: "N입니다", meaning: "is N", explanation: "Fixture",
      examples: [], sourceRef: sectionRef, patternSourceRef: patternRef,
    }];
    patternBundle.course.questions[0].sourceRef = patternRef;
    patternBundle.sourceInventory.items[0] = {
      ...patternBundle.sourceInventory.items[0], id: "grammar-section-as-pattern",
      kind: "grammar", sourceRef: patternRef, contentPointer: "/grammar/0/pattern",
      practiceQuestionIds: ["q1"],
    };
    const patternReport = auditCurriculumCoverage(patternBundle);
    expect(patternReport.status).toBe("partial");
    expect(patternReport.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");
  });

  it("keeps extra-section containers distinct from exercise subparts", () => {
    const parent = fixture(); parent.sourceInventory = inventory();
    parent.sourceInventory.items[1].kind = "exercise";
    const wrongParentKind = auditCurriculumCoverage(parent);
    expect(wrongParentKind.status).toBe("partial");
    expect(wrongParentKind.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");

    parent.sourceInventory.items[1].kind = "exerciseSection";
    const validParent = auditCurriculumCoverage(parent);
    expect(validParent.status).toBe("complete");
    expect(validParent.auditVersion).toBe(7);

    const child = fixture(); child.sourceInventory = inventory();
    const childRef = child.sourceInventory.items[1].sourceRef;
    child.course.lessons[0].extraSections![0].contentSourceRefs = [childRef];
    child.sourceInventory.items[1] = {
      ...child.sourceInventory.items[1],
      id: "exercise-subpart",
      kind: "exerciseSection",
      contentPointer: "/extraSections/0/content/0",
    };
    const wrongChildKind = auditCurriculumCoverage(child);
    expect(wrongChildKind.status).toBe("partial");
    expect(wrongChildKind.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");

    child.sourceInventory.items[1].kind = "exercise";
    const validChild = auditCurriculumCoverage(child);
    expect(validChild.status).toBe("complete");
    expect(validChild.sourceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
  });

  it("requires one inventory item per exercise-section content entry when a container has multiple entries", () => {
    const parent = fixture();
    parent.sourceInventory = inventory();
    parent.course.lessons[0].extraSections![0].content = [
      "Translate the first source sentence.",
      "Complete the second source exercise.",
    ];

    const parentReport = auditCurriculumCoverage(parent);
    expect(parentReport.status).toBe("partial");
    expect(parentReport.sourceCoverage).toEqual({ covered: 1, total: 4, percent: 25 });
    expect(parentReport.practiceCoverage).toEqual({ covered: 1, total: 4, percent: 25 });
    expect(parentReport.issues.join(" ")).toContain(
      "Section nguồn có nhiều mục con; cần kiểm kê từng mục /content/{index}",
    );

    // Pointing at the entire content array must not bypass the same aggregate guard.
    const contentArray = fixture();
    contentArray.sourceInventory = inventory();
    contentArray.course.lessons[0].extraSections![0].content = [
      "Translate the first source sentence.",
      "Complete the second source exercise.",
    ];
    contentArray.sourceInventory.items[1] = {
      ...contentArray.sourceInventory.items[1],
      kind: "exerciseSection",
      contentPointer: "/extraSections/0/content",
    };
    const contentArrayReport = auditCurriculumCoverage(contentArray);
    expect(contentArrayReport.status).toBe("partial");
    expect(contentArrayReport.sourceCoverage).toEqual({ covered: 1, total: 4, percent: 25 });
    expect(contentArrayReport.issues.join(" ")).toContain(
      "Section nguồn có nhiều mục con; cần kiểm kê từng mục /content/{index}",
    );

    const children = fixture();
    children.sourceInventory = inventory();
    const section = children.course.lessons[0].extraSections![0];
    const firstRef = children.sourceInventory.items[1].sourceRef;
    const secondRef = "synthetic.pdf · p.2 · exercise-second";
    section.content = [
      "Translate the first source sentence.",
      "Complete the second source exercise.",
    ];
    section.contentSourceRefs = [firstRef, secondRef];

    const parentItem = children.sourceInventory.items[1];
    children.sourceInventory.items[1] = {
      ...parentItem,
      id: "exercise-subpart-0",
      kind: "exercise",
      contentPointer: "/extraSections/0/content/0",
    };
    children.sourceInventory.items.push({
      ...parentItem,
      id: "exercise-subpart-1",
      kind: "exercise",
      sourceRef: secondRef,
      contentPointer: "/extraSections/0/content/1",
    });

    const childReport = auditCurriculumCoverage(children);
    expect(childReport.status).toBe("complete");
    expect(childReport.sourceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
    expect(childReport.practiceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
  });

  it("requires separate inventory rows for nested source units hidden behind aggregate pointers", () => {
    const cases: Array<{
      id: string;
      pointer: string;
      kind: string;
      expectedChildren: string[];
      skill: "vocabulary" | "grammar" | "listening" | "speaking" | "reading" | "writing";
      prompt: string;
      answer: string;
      setup: (bundle: CompiledCourseBundle, ref: string) => void;
    }> = [
      {
        id: "vocabulary-parent", pointer: "/vocabulary/0", kind: "vocabulary",
        expectedChildren: ["/vocabulary/0/example"], skill: "vocabulary",
        prompt: "Recall the example", answer: "저는 학생입니다.",
        setup: (bundle, ref) => { bundle.course.lessons[0].vocabulary[0].example = "저는 학생입니다."; bundle.course.lessons[0].vocabulary[0].sourceRef = ref; },
      },
      {
        id: "grammar-parent", pointer: "/grammar/0", kind: "grammar",
        expectedChildren: ["/grammar/0/pattern", "/grammar/0/examples/0"], skill: "grammar",
        prompt: "Recall the pattern", answer: "N입니다",
        setup: (bundle, ref) => { bundle.course.lessons[0].grammar = [{ id: "g1", pattern: "N입니다", meaning: "là N", explanation: "Fixture", examples: ["저는 학생입니다."], sourceRef: ref }]; },
      },
      {
        id: "listening-parent", pointer: "/listening/0", kind: "listening",
        expectedChildren: ["/listening/0/choices/0", "/listening/0/choices/1"], skill: "listening",
        prompt: "Recall the listening item", answer: "B",
        setup: (bundle, ref) => { bundle.course.lessons[0].listening = [{ id: "l1", text: "Listen to the dialogue", meaning: "Nghe hội thoại", choices: ["A", "B"], answer: "B", sourceRef: ref }]; },
      },
      {
        id: "dialogue-parent", pointer: "/dialogues/0", kind: "dialogue",
        expectedChildren: ["/dialogues/0/lines/0", "/dialogues/0/lines/1"], skill: "speaking",
        prompt: "Recall the dialogue", answer: "안녕하세요.",
        setup: (bundle, ref) => { bundle.course.lessons[0].dialogues = [{ id: "d1", title: "Greeting", sourceRef: ref, lines: [{ speaker: "A", targetText: "안녕하세요.", ko: "안녕하세요.", sourceRef: "synthetic.pdf · p.1 · line-a" }, { speaker: "B", targetText: "네, 안녕하세요.", ko: "네, 안녕하세요.", sourceRef: "synthetic.pdf · p.1 · line-b" }] }]; },
      },
      {
        id: "reading-parent", pointer: "/reading", kind: "readingsection",
        expectedChildren: ["/reading/title", "/reading/text", "/reading/questions/0", "/reading/questions/0/choices/0", "/reading/questions/0/choices/1"], skill: "reading",
        prompt: "Recall the reading section", answer: "Passage",
        setup: (bundle, ref) => { bundle.course.lessons[0].reading = { title: "Title", text: "Passage", translation: "Đoạn đọc", sourceRef: ref, questions: [{ id: "r1", q: "Question?", choices: ["A", "B"], answer: "A", sourceRef: "synthetic.pdf · p.1 · reading-question" }] }; },
      },
      {
        id: "writing-parent", pointer: "/writing", kind: "writingtask",
        expectedChildren: ["/writing/prompt", "/writing/targetWords/0"], skill: "writing",
        prompt: "Recall the writing task", answer: "저",
        setup: (bundle, ref) => { bundle.course.lessons[0].writing = { prompt: "Write one sentence using 저.", hint: "Fixture", targetWords: ["저"], sourceRef: ref }; },
      },
      {
        id: "pronunciation-parent", pointer: "/pronunciation/0", kind: "pronunciation",
        expectedChildren: ["/pronunciation/0/examples/0"], skill: "speaking",
        prompt: "Recall the pronunciation rule", answer: "학교",
        setup: (bundle, ref) => { bundle.course.lessons[0].pronunciation = [{ id: "p1", title: "Pronunciation", explanation: "Pronunciation rule", examples: ["학교"], sourceRef: ref }]; },
      },
    ];

    for (const scenario of cases) {
      const bundle = fixture();
      bundle.sourceInventory = inventory();
      const ref = "synthetic.pdf · p.1 · " + scenario.id;
      scenario.setup(bundle, ref);
      bundle.course.questions[0] = {
        ...bundle.course.questions[0], skill: scenario.skill, type: "input",
        title: scenario.id, prompt: scenario.prompt, answer: scenario.answer,
        explanation: "Synthetic parent fixture", sourceRef: ref, origin: "source",
      };
      bundle.sourceInventory.items[0] = {
        ...bundle.sourceInventory.items[0], id: scenario.id, kind: scenario.kind,
        sourceRef: ref, contentPointer: scenario.pointer, practiceMethod: "questions",
        motif: "input", practiceQuestionIds: ["q1"],
      };

      const report = auditCurriculumCoverage(bundle);
      expect(report.status, scenario.id).toBe("partial");
      expect(report.sourceCoverage.total, scenario.id).toBe(2 + scenario.expectedChildren.length);
      expect(report.issues.join(" "), scenario.id).toContain("Thiếu item-level inventory cho mục con");
      for (const childPointer of scenario.expectedChildren) {
        expect(report.issues.join(" "), scenario.id).toContain(childPointer);
      }
    }
  });

  it("keeps reading and writing section kinds distinct from nested text/prompt kinds", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.course.lessons[0].extraSections = [];
    bundle.sourceInventory.pages[1] = {
      fileName: "synthetic.pdf", pageNumber: 2, status: "reviewed",
      classification: "non-learning", reason: "Synthetic blank page",
    };

    const readingRef = "synthetic.pdf · p.1 · reading-text";
    const promptRef = "synthetic.pdf · p.1 · writing-prompt";
    bundle.course.lessons[0].reading = {
      title: "Reading title", text: "Original reading passage", translation: "Bản dịch",
      questions: [], sourceRef: "synthetic.pdf · p.1 · reading-section", textSourceRef: readingRef,
    };
    bundle.course.lessons[0].writing = {
      prompt: "Write a short self-introduction.", hint: "Use the lesson grammar.",
      targetWords: [], sourceRef: "synthetic.pdf · p.1 · writing-task", promptSourceRef: promptRef,
    };
    bundle.course.questions.push(
      { id: "q-reading-text", lessonId: 1, skill: "reading", type: "input", title: "Passage", prompt: "Passage", answer: "Original reading passage", explanation: "Fixture", sourceRef: readingRef, origin: "source" },
      { id: "q-writing-prompt", lessonId: 1, skill: "writing", type: "input", title: "Prompt", prompt: "Write a short self-introduction.", answer: "Fixture answer", explanation: "Fixture", sourceRef: promptRef, origin: "source" },
    );
    bundle.sourceInventory.items[1] = {
      ...bundle.sourceInventory.items[1],
      id: "reading-text", kind: "reading", pageNumber: 1, sourceRef: readingRef,
      contentPointer: "/reading/text", practiceMethod: "questions", motif: "input",
      practiceQuestionIds: ["q-reading-text"],
    };
    bundle.sourceInventory.items.push({
      ...bundle.sourceInventory.items[1],
      id: "writing-prompt", kind: "writingtask", sourceRef: promptRef,
      contentPointer: "/writing/prompt", practiceQuestionIds: ["q-writing-prompt"],
    });

    const wrongKinds = auditCurriculumCoverage(bundle);
    expect(wrongKinds.status).toBe("partial");
    expect(wrongKinds.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");

    bundle.sourceInventory.items[1].kind = "readingtext";
    bundle.sourceInventory.items[2].kind = "writingprompt";
    const exactKinds = auditCurriculumCoverage(bundle);
    expect(exactKinds.status).toBe("complete");
    expect(exactKinds.sourceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
    expect(exactKinds.practiceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
  });

  it("fails closed for unknown source kinds instead of treating a valid pointer as proof", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items[0].kind = "unclassified-source-kind";
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(1);
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("SOURCE_KIND_POINTER_MISMATCH");
  });

  it("supports source-linked illustrations as inventory destinations", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const ref = "synthetic.pdf · p.1 · illustration";
    bundle.course.lessons[0].illustrations = [{
      id: "ill1", kind: "context", targetIds: ["v1"], relation: "context",
      fileName: "synthetic.pdf", pageNumber: 1, region: [0, 0, 1, 1],
      alt: "Classroom scene", caption: "Synthetic illustration", sourceRef: ref,
    }];
    bundle.course.questions[0].sourceRef = ref;
    bundle.sourceInventory.items[0] = {
      ...bundle.sourceInventory.items[0], id: "illustration", kind: "illustration",
      sourceRef: ref, contentPointer: "/illustrations/0",
    };
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("complete");
    expect(report.sourceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
    expect(report.practiceCoverage.percent).toBe(100);
    expect(report.validationCoverage.percent).toBe(100);
  });


  it("requires item-level refs for listening choices instead of inheriting the parent ref", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const refA = "synthetic.pdf · p.1 · listening-choice-a";
    const refB = "synthetic.pdf · p.1 · listening-choice-b";
    bundle.course.lessons[0].listening = [{
      id: "listen-1", text: "Listen", meaning: "Nghe", choices: ["A", "B"], answer: "B",
      sourceRef: "synthetic.pdf · p.1 · listening-parent",
    }];
    bundle.course.questions.push(
      { id: "q-listen-a", lessonId: 1, skill: "listening", type: "input", title: "A", prompt: "A", answer: "A", explanation: "Fixture", sourceRef: refA, origin: "source" },
      { id: "q-listen-b", lessonId: 1, skill: "listening", type: "input", title: "B", prompt: "B", answer: "B", explanation: "Fixture", sourceRef: refB, origin: "source" },
    );
    bundle.sourceInventory.items.push(
      { id: "listen-choice-a", lessonId: 1, kind: "listening-choice", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: refA, contentPointer: "/listening/0/choices/0", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-listen-a"], verified: true },
      { id: "listen-choice-b", lessonId: 1, kind: "listening-choice", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: refB, contentPointer: "/listening/0/choices/1", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-listen-b"], verified: true },
    );

    const missing = auditCurriculumCoverage(bundle);
    expect(missing.sourceCoverage).toEqual({ covered: 2, total: 4, percent: 50 });
    expect(missing.status).toBe("partial");

    bundle.course.lessons[0].listening[0].choiceSourceRefs = [refA, refB];
    const reconciled = auditCurriculumCoverage(bundle);
    expect(reconciled.status).toBe("complete");
    expect(reconciled.sourceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
    expect(reconciled.practiceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
  });

  it("requires item-level refs for reading choices instead of inheriting the passage or question ref", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const refA = "synthetic.pdf · p.1 · reading-choice-a";
    const refB = "synthetic.pdf · p.1 · reading-choice-b";
    bundle.course.lessons[0].reading = {
      title: "Reading", text: "Fixture passage", translation: "Đoạn đọc mẫu",
      sourceRef: "synthetic.pdf · p.1 · reading-passage",
      questions: [{
        id: "read-1", q: "Question", choices: ["A", "B"], answer: "A",
        sourceRef: "synthetic.pdf · p.1 · reading-question",
      }],
    };
    bundle.course.questions.push(
      { id: "q-reading-a", lessonId: 1, skill: "reading", type: "input", title: "A", prompt: "A", answer: "A", explanation: "Fixture", sourceRef: refA, origin: "source" },
      { id: "q-reading-b", lessonId: 1, skill: "reading", type: "input", title: "B", prompt: "B", answer: "B", explanation: "Fixture", sourceRef: refB, origin: "source" },
    );
    bundle.sourceInventory.items.push(
      { id: "reading-choice-a", lessonId: 1, kind: "reading-choice", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: refA, contentPointer: "/reading/questions/0/choices/0", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-reading-a"], verified: true },
      { id: "reading-choice-b", lessonId: 1, kind: "reading-choice", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: refB, contentPointer: "/reading/questions/0/choices/1", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-reading-b"], verified: true },
    );

    const missing = auditCurriculumCoverage(bundle);
    expect(missing.sourceCoverage).toEqual({ covered: 2, total: 4, percent: 50 });
    expect(missing.status).toBe("partial");

    bundle.course.lessons[0].reading!.questions[0].choiceSourceRefs = [refA, refB];
    const reconciled = auditCurriculumCoverage(bundle);
    expect(reconciled.status).toBe("complete");
    expect(reconciled.sourceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
    expect(reconciled.practiceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
  });



  it("requires inventory for a source-referenced embedded reading question without a parent inventory row", () => {
    const bundle = fixture();
    bundle.sourceInventory = inventory();
    const questionRef = "synthetic.pdf · p.1 · reading-question";
    bundle.course.lessons[0].reading = {
      title: "Reading title",
      text: "Original reading passage",
      translation: "Đoạn đọc gốc",
      sourceRef: "synthetic.pdf · p.1 · reading-section",
      questions: [{
        id: "embedded-reading-question",
        q: "Who is speaking?",
        choices: ["A", "B"],
        answer: "A",
        sourceRef: questionRef,
      }],
    };

    // There is no inventory row for /reading or /reading/questions/0.
    // Reverse reconciliation must still find the explicitly source-backed child.
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain(
      "Thiếu item-level inventory cho nội dung có sourceRef 1:/reading/questions/0",
    );
  });

  it("requires exact refs for reading title and passage text instead of inheriting the section ref", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const titleRef = "synthetic.pdf · p.1 · reading-title";
    const textRef = "synthetic.pdf · p.1 · reading-text";
    bundle.course.lessons[0].reading = {
      title: "Reading title", text: "Original reading passage", translation: "Bản dịch",
      questions: [], sourceRef: "synthetic.pdf · p.1 · reading-section",
    };
    bundle.course.questions.push(
      { id: "q-reading-title", lessonId: 1, skill: "reading", type: "input", title: "Title", prompt: "Title", answer: "Title", explanation: "Fixture", sourceRef: titleRef, origin: "source" },
      { id: "q-reading-text", lessonId: 1, skill: "reading", type: "input", title: "Passage", prompt: "Passage", answer: "Passage", explanation: "Fixture", sourceRef: textRef, origin: "source" },
    );
    bundle.sourceInventory.items.push(
      { id: "reading-title", lessonId: 1, kind: "readingtitle", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: titleRef, contentPointer: "/reading/title", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-reading-title"], verified: true },
      { id: "reading-text", lessonId: 1, kind: "readingtext", fileName: "synthetic.pdf", pageNumber: 1, sourceRef: textRef, contentPointer: "/reading/text", practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-reading-text"], verified: true },
    );

    const missing = auditCurriculumCoverage(bundle);
    expect(missing.status).toBe("partial");
    expect(missing.sourceCoverage).toEqual({ covered: 2, total: 4, percent: 50 });
    expect(missing.issues.join(" ")).toContain("sourceRef inventory không khớp");

    bundle.course.lessons[0].reading!.titleSourceRef = titleRef;
    bundle.course.lessons[0].reading!.textSourceRef = textRef;
    const reconciled = auditCurriculumCoverage(bundle);
    expect(reconciled.status).toBe("complete");
    expect(reconciled.sourceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
    expect(reconciled.practiceCoverage).toEqual({ covered: 4, total: 4, percent: 100 });
  });


  it("requires an exact ref for an inventoried writing prompt instead of inheriting the task ref", () => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    const promptRef = "synthetic.pdf · p.1 · writing-prompt";
    bundle.course.lessons[0].writing = {
      prompt: "Write a short self-introduction.", hint: "Use the lesson grammar.",
      targetWords: [], sourceRef: "synthetic.pdf · p.1 · writing-task",
    };
    bundle.course.questions.push({
      id: "q-writing-prompt", lessonId: 1, skill: "writing", type: "input",
      title: "Writing prompt", prompt: "Write a short self-introduction.",
      answer: "Fixture answer", explanation: "Fixture", sourceRef: promptRef, origin: "source",
    });
    bundle.sourceInventory.items.push({
      id: "writing-prompt", lessonId: 1, kind: "writingprompt", fileName: "synthetic.pdf",
      pageNumber: 1, sourceRef: promptRef, contentPointer: "/writing/prompt",
      practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-writing-prompt"], verified: true,
    });

    const missing = auditCurriculumCoverage(bundle);
    expect(missing.status).toBe("partial");
    expect(missing.sourceCoverage.covered).toBe(2);
    expect(missing.sourceCoverage.total).toBe(3);
    expect(missing.sourceCoverage.percent).toBeCloseTo(200 / 3);

    bundle.course.lessons[0].writing!.promptSourceRef = promptRef;
    const reconciled = auditCurriculumCoverage(bundle);
    expect(reconciled.status).toBe("complete");
    expect(reconciled.sourceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
    expect(reconciled.practiceCoverage).toEqual({ covered: 3, total: 3, percent: 100 });
  });


  it("preserves reading/writing item refs through bundle parse before auditing", () => {
    const bundle = fixture();
    const sourceInventory = inventory();
    bundle.sourceInventory = sourceInventory;
    const lesson = bundle.course.lessons[0];
    const refs = {
      title: "synthetic.pdf · p.1 · reading-title",
      text: "synthetic.pdf · p.1 · reading-text",
      prompt: "synthetic.pdf · p.1 · writing-prompt",
      targetWord: "synthetic.pdf · p.1 · writing-target-word",
    };

    lesson.reading = {
      title: "Reading title",
      text: "Read this short passage.",
      translation: "Đọc đoạn văn ngắn này.",
      sourceRef: "synthetic.pdf · p.1 · reading-section",
      titleSourceRef: refs.title,
      textSourceRef: refs.text,
      questions: [],
    };
    lesson.writing = {
      prompt: "Write one sentence.",
      hint: "Use the target word.",
      targetWords: ["저"],
      sourceRef: "synthetic.pdf · p.1 · writing-section",
      promptSourceRef: refs.prompt,
      targetWordSourceRefs: [refs.targetWord],
    };

    const sourceItems: Array<{
      id: string;
      kind: string;
      contentPointer: string;
      sourceRef: string;
      questionId: string;
      skill: "reading" | "writing";
      prompt: string;
      answer: string;
    }> = [
      { id: "reading-title", kind: "readingtitle", contentPointer: "/reading/title",
        sourceRef: refs.title, questionId: "q-reading-title", skill: "reading",
        prompt: "Recall the reading title.", answer: "Reading title" },
      { id: "reading-text", kind: "readingtext", contentPointer: "/reading/text",
        sourceRef: refs.text, questionId: "q-reading-text", skill: "reading",
        prompt: "Recall the reading passage.", answer: "Read this short passage." },
      { id: "writing-prompt", kind: "writingprompt", contentPointer: "/writing/prompt",
        sourceRef: refs.prompt, questionId: "q-writing-prompt-roundtrip", skill: "writing",
        prompt: "Recall the writing task.", answer: "Write one sentence." },
      { id: "writing-target-word", kind: "writingtargetword", contentPointer: "/writing/targetWords/0",
        sourceRef: refs.targetWord, questionId: "q-writing-target-word", skill: "writing",
        prompt: "Write the target word.", answer: "저" },
    ];

    for (const item of sourceItems) {
      bundle.course.questions.push({
        id: item.questionId, lessonId: 1, skill: item.skill, type: "input",
        title: item.id, prompt: item.prompt, answer: item.answer,
        explanation: "Synthetic round-trip fixture", sourceRef: item.sourceRef, origin: "source",
      });
      sourceInventory.items.push({
        id: item.id, lessonId: 1, kind: item.kind, fileName: "synthetic.pdf", pageNumber: 1,
        sourceRef: item.sourceRef, contentPointer: item.contentPointer,
        practiceMethod: "questions", motif: "input", practiceQuestionIds: [item.questionId], verified: true,
      });
    }

    const parsed = parseCourseBundle(JSON.stringify(bundle));
    const roundTripped = parsed.course.lessons[0];
    expect(roundTripped.reading?.titleSourceRef).toBe(refs.title);
    expect(roundTripped.reading?.textSourceRef).toBe(refs.text);
    expect(roundTripped.writing?.promptSourceRef).toBe(refs.prompt);
    expect(roundTripped.writing?.targetWordSourceRefs).toEqual([refs.targetWord]);

    const report = auditCurriculumCoverage(parsed);
    expect(report.status).toBe("complete");
    expect(report.sourceCoverage).toEqual({ covered: 6, total: 6, percent: 100 });
    expect(report.practiceCoverage).toEqual({ covered: 6, total: 6, percent: 100 });
    expect(report.validationCoverage).toEqual({ covered: 6, total: 6, percent: 100 });
  });

  it("requires exact item-level evidence for an independently inventoried grammar pattern and preserves it through bundle parsing", () => {
    const bundle = fixture();
    bundle.sourceManifest = [{
      name: "synthetic.pdf", size: 1, lastModified: 1, pageCount: 1, sha256: "a".repeat(64),
    }];
    const patternRef = "synthetic.pdf · p.1 · grammar-pattern";
    const lesson = bundle.course.lessons[0];
    lesson.vocabulary = [];
    lesson.extraSections = [];
    lesson.grammar = [{
      id: "g1", pattern: "N입니다", meaning: "là N", explanation: "Synthetic rule",
      examples: [], sourceRef: "synthetic.pdf · p.1 · grammar-section",
    }];
    bundle.course.questions = [{
      id: "q-pattern", lessonId: 1, skill: "grammar", type: "input", title: "Pattern",
      prompt: "Write the grammar pattern", answer: "N입니다", explanation: "Synthetic fixture",
      sourceRef: patternRef, origin: "source",
    }];
    bundle.sourceInventory = {
      version: 1,
      pages: [{ fileName: "synthetic.pdf", pageNumber: 1, status: "reviewed", classification: "learning-content" }],
      items: [{
        id: "grammar-pattern", lessonId: 1, kind: "grammarpattern", fileName: "synthetic.pdf",
        pageNumber: 1, sourceRef: patternRef, contentPointer: "/grammar/0/pattern",
        practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-pattern"], verified: true,
      }],
    };

    const withoutExactRef = auditCurriculumCoverage(bundle);
    expect(withoutExactRef.sourceCoverage.covered).toBe(0);
    expect(withoutExactRef.issues.join(" ")).toContain("sourceRef inventory không khớp");

    lesson.grammar[0].patternSourceRef = patternRef;
    const parsed = parseCourseBundle(JSON.stringify(bundle));
    expect(parsed.course.lessons[0].grammar[0].patternSourceRef).toBe(patternRef);
    const report = auditCurriculumCoverage(parsed);
    expect(report.status).toBe("complete");
    expect(report.sourceCoverage).toEqual({ covered: 1, total: 1, percent: 100 });
    expect(report.practiceCoverage).toEqual({ covered: 1, total: 1, percent: 100 });
    expect(report.validationCoverage).toEqual({ covered: 1, total: 1, percent: 100 });
  });

  it("rejects an explicitly blank grammar-pattern ref instead of treating it as evidence", () => {
    const bundle = fixture();
    bundle.sourceManifest = [{
      name: "synthetic.pdf", size: 1, lastModified: 1, pageCount: 1, sha256: "a".repeat(64),
    }];
    const lesson = bundle.course.lessons[0];
    lesson.vocabulary = [];
    lesson.extraSections = [];
    lesson.grammar = [{
      id: "g1", pattern: "N입니다", meaning: "là N", explanation: "Synthetic rule",
      examples: [], sourceRef: "synthetic.pdf · p.1 · grammar-section", patternSourceRef: " ",
    }];
    bundle.course.questions = [];
    bundle.sourceInventory = {
      version: 1,
      pages: [{ fileName: "synthetic.pdf", pageNumber: 1, status: "reviewed", classification: "learning-content" }],
      items: [{
        id: "grammar-pattern", lessonId: 1, kind: "grammarpattern", fileName: "synthetic.pdf",
        pageNumber: 1, sourceRef: "synthetic.pdf · p.1 · grammar-pattern",
        contentPointer: "/grammar/0/pattern", practiceMethod: "questions", motif: "input",
        practiceQuestionIds: [], verified: true,
      }],
    };
    const report = auditCurriculumCoverage(bundle);
    expect(report.status).not.toBe("complete");
    expect(report.issues.join(" ")).toContain("Tham chiếu mẫu ngữ pháp rỗng");
  });

  it("requires inventory for explicitly referenced child items even when their parent row is absent", () => {
    const bundle = fixture();
    bundle.sourceManifest = [{
      name: "synthetic.pdf", size: 1, lastModified: 1, pageCount: 1, sha256: "a".repeat(64),
    }];
    const lesson = bundle.course.lessons[0];
    lesson.vocabulary = [];
    lesson.extraSections = [];
    const patternRef = "synthetic.pdf · p.1 · grammar-pattern";
    const exampleRef = "synthetic.pdf · p.1 · grammar-example";
    lesson.grammar = [{
      id: "g1", pattern: "N입니다", meaning: "là N", explanation: "Synthetic rule",
      examples: ["저는 학생입니다."], sourceRef: "synthetic.pdf · p.1 · grammar-section",
      patternSourceRef: patternRef, exampleSourceRefs: [exampleRef],
    }];
    bundle.course.questions = [{
      id: "q-pattern", lessonId: 1, skill: "grammar", type: "input", title: "Pattern",
      prompt: "Write the grammar pattern", answer: "N입니다", explanation: "Synthetic fixture",
      sourceRef: "Derived from " + patternRef, origin: "derived",
    }];
    bundle.sourceInventory = {
      version: 1,
      pages: [{ fileName: "synthetic.pdf", pageNumber: 1, status: "reviewed", classification: "learning-content" }],
      items: [{
        id: "grammar-pattern", lessonId: 1, kind: "grammarpattern", fileName: "synthetic.pdf",
        pageNumber: 1, sourceRef: patternRef, contentPointer: "/grammar/0/pattern",
        practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-pattern"], verified: true,
      }],
    };

    const incomplete = auditCurriculumCoverage(bundle);
    expect(incomplete.status).toBe("partial");
    expect(incomplete.sourceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(incomplete.practiceCoverage).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(incomplete.issues.join(" ")).toContain("/grammar/0/examples/0");

    bundle.course.questions.push({
      id: "q-example", lessonId: 1, skill: "grammar", type: "input", title: "Example",
      prompt: "Complete the example", answer: "저는 학생입니다.", explanation: "Synthetic fixture",
      sourceRef: "Derived from " + exampleRef, origin: "derived",
    });
    bundle.sourceInventory.items.push({
      id: "grammar-example", lessonId: 1, kind: "grammarexample", fileName: "synthetic.pdf",
      pageNumber: 1, sourceRef: exampleRef, contentPointer: "/grammar/0/examples/0",
      practiceMethod: "questions", motif: "input", practiceQuestionIds: ["q-example"], verified: true,
    });
    const complete = auditCurriculumCoverage(bundle);
    expect(complete.status).toBe("complete");
    expect(complete.sourceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
    expect(complete.practiceCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
    expect(complete.validationCoverage).toEqual({ covered: 2, total: 2, percent: 100 });
  });

});
