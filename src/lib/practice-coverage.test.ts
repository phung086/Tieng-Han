import { describe, expect, it } from "vitest";
import { auditLessonPracticeCoverage } from "@/lib/practice-coverage";
import type { LessonContent, StudyQuestion } from "@/data/content";

const lesson: LessonContent = {
  id: 1, title: "인사", vi: "Chào hỏi", objective: "",
  vocabulary: [
    { id: "v1", ko: "안녕", vi: "xin chào", example: "", sourceRef: "book:p1:v1" },
    { id: "v2", ko: "학생", vi: "học sinh", example: "", sourceRef: "book:p1:v2" },
  ],
  grammar: [{ id: "g1", pattern: "입니다", meaning: "", explanation: "", examples: ["저는 학생입니다.", "선생님입니다."], sourceRef: "book:p2:g1" }],
  listening: [], speaking: [], reading: null, writing: null,
};
const question = (id: string, sourceRef?: string): StudyQuestion => ({
  id, lessonId: 1, skill: "vocabulary", type: "input", title: "",
  prompt: "?", answer: "!", explanation: "", sourceRef,
});

describe("source-grounded practice coverage", () => {
  it("never confuses total quiz count with lesson-item coverage", () => {
    const report = auditLessonPracticeCoverage(lesson, [
      question("q1", "book:p1:v1"),
      question("q2", "book:p1:v1"),
      question("q3", "book:p1:v1"),
    ]);
    expect(report.sourceItems).toBe(4);
    expect(report.verifiedItems).toBe(1);
    expect(report.uncovered).toHaveLength(3);
    expect(report.complete).toBe(false);
  });
  it("does not grant coverage from a shared grammar section reference", () => {
    const report = auditLessonPracticeCoverage(lesson, [question("qg", "book:p2:g1")]);
    expect(report.ambiguous).toHaveLength(2);
    expect(report.verifiedItems).toBe(0);
  });
  it("can verify every uniquely evidenced item", () => {
    const simple = { ...lesson, grammar: [] };
    const report = auditLessonPracticeCoverage(simple, [
      question("q1", "book:p1:v1"), question("q2", "book:p1:v2"),
    ]);
    expect(report.complete).toBe(true);
    expect(report.verifiedItems).toBe(2);
  });
  it("uses exact item-level refs for speaking prompts", () => {
    const speakingLesson: LessonContent = {
      ...lesson,
      vocabulary: [],
      grammar: [],
      speaking: ["안녕하세요.", "감사합니다."],
      speakingSourceRefs: ["book:p3:speaking-0", "book:p3:speaking-1"],
      sourceRef: "book:p3:speaking-section",
    };
    const report = auditLessonPracticeCoverage(speakingLesson, [
      question("qs1", "book:p3:speaking-0"),
      question("qs2", "book:p3:speaking-1"),
    ]);
    expect(report.sourceItems).toBe(2);
    expect(report.verifiedItems).toBe(2);
    expect(report.items.map(item => item.sourceRef)).toEqual([
      "book:p3:speaking-0",
      "book:p3:speaking-1",
    ]);
    expect(report.complete).toBe(true);
  });

  it("does not inherit a section-level ref for unreferenced speaking prompts", () => {
    const speakingLesson: LessonContent = {
      ...lesson,
      vocabulary: [],
      grammar: [],
      speaking: ["안녕하세요."],
      sourceRef: "book:p3:speaking-section",
    };
    const report = auditLessonPracticeCoverage(speakingLesson, [
      question("qs-section", "book:p3:speaking-section"),
    ]);
    expect(report.items[0].sourceRef).toBeUndefined();
    expect(report.verifiedItems).toBe(0);
    expect(report.complete).toBe(false);
  });

  it("rejects another lesson's questions and absent evidence", () => {
    const report = auditLessonPracticeCoverage({ ...lesson, grammar: [] }, [
      { ...question("q", "book:p1:v1"), lessonId: 2 },
      question("q-no-ref"),
    ]);
    expect(report.verifiedItems).toBe(0);
  });
});
