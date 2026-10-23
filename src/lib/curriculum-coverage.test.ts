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
      sourceRef: "synthetic.pdf · p.1 · v1", contentPointer: "/vocabulary/0", practiceMethod: "questions", practiceQuestionIds: ["q1"], verified: true },
    { id: "exercise", lessonId: 1, kind: "exercise", fileName: "synthetic.pdf", pageNumber: 2,
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
  it.each([
    { label: "wrong page", ref: "synthetic.pdf · p.1 · exercise" },
    { label: "missing page anchor", ref: "synthetic.pdf · exercise" },
  ])("rejects an inventory and target ref with $label", ({ ref }) => {
    const bundle = fixture(); bundle.sourceInventory = inventory();
    bundle.sourceInventory.items[1].sourceRef = ref;
    bundle.course.lessons[0].extraSections![0].sourceRef = ref;
    const report = auditCurriculumCoverage(bundle);
    expect(report.sourceCoverage.covered).toBe(1);
    expect(report.status).toBe("partial");
    expect(report.issues.join(" ")).toContain("sourceRef không khớp tệp/trang kiểm kê");
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
});
