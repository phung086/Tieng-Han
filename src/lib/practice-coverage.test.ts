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

  it("does not grant example coverage from a shared grammar section reference", () => {
    const report = auditLessonPracticeCoverage(lesson, [question("qg", "book:p2:g1")]);
    const examples = report.items.filter(item => item.kind === "grammar-example");
    expect(examples).toHaveLength(2);
    expect(examples.every(item => item.sourceRef === undefined)).toBe(true);
    expect(report.verifiedItems).toBe(0);
    expect(report.uncovered).toHaveLength(4);
    expect(report.complete).toBe(false);
  });

  it("uses exact per-example refs for vocabulary and grammar examples", () => {
    const itemLesson: LessonContent = {
      ...lesson,
      vocabulary: [{
        id: "v-example", ko: "학생", vi: "học sinh",
        example: "저는 학생입니다.", sourceRef: "book:p1:v-example",
        exampleSourceRef: "book:p1:v-example-sentence",
      }],
      grammar: [{
        id: "g-example", pattern: "입니다", meaning: "", explanation: "",
        examples: ["선생님입니다.", "의사입니다."],
        sourceRef: "book:p2:g-example",
        exampleSourceRefs: ["book:p2:g-example-0", "book:p2:g-example-1"],
      }],
    };
    const report = auditLessonPracticeCoverage(itemLesson, [
      question("q-word", "book:p1:v-example"),
      question("q-v-example", "book:p1:v-example-sentence"),
      question("q-g-example-0", "book:p2:g-example-0"),
      question("q-g-example-1", "book:p2:g-example-1"),
    ]);
    expect(report.sourceItems).toBe(4);
    expect(report.verifiedItems).toBe(4);
    expect(report.complete).toBe(true);
  });

  it("does not inherit a vocabulary example ref from its parent word", () => {
    const itemLesson: LessonContent = {
      ...lesson,
      vocabulary: [{
        id: "v-example", ko: "학생", vi: "học sinh",
        example: "저는 학생입니다.", sourceRef: "book:p1:v-example",
      }],
      grammar: [],
    };
    const report = auditLessonPracticeCoverage(itemLesson, [
      question("q-word", "book:p1:v-example"),
    ]);
    expect(report.items.map(item => item.kind)).toEqual(["vocabulary", "vocabulary-example"]);
    expect(report.items[1].sourceRef).toBeUndefined();
    expect(report.verifiedItems).toBe(1);
    expect(report.complete).toBe(false);
  });

  it("can verify every uniquely evidenced vocabulary item", () => {
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

  it("does not inherit a dialogue line ref from its parent dialogue", () => {
    const dialogueLesson: LessonContent = {
      ...lesson,
      vocabulary: [],
      grammar: [],
      dialogues: [{
        id: "d1",
        sourceRef: "book:p4:dialogue",
        lines: [{ ko: "안녕하세요." }],
      }],
    };
    const report = auditLessonPracticeCoverage(dialogueLesson, [
      question("qd", "book:p4:dialogue"),
    ]);
    expect(report.items[0].sourceRef).toBeUndefined();
    expect(report.verifiedItems).toBe(0);
    expect(report.complete).toBe(false);
  });

  it("uses item-level refs for reading title/text and writing prompt/target words", () => {
    const itemLesson: LessonContent = {
      ...lesson,
      vocabulary: [],
      grammar: [],
      reading: {
        title: "학교", text: "저는 학교에 갑니다.", translation: "Tôi đi học.",
        questions: [], sourceRef: "book:p5:reading-section",
        titleSourceRef: "book:p5:reading-title",
        textSourceRef: "book:p5:reading-text",
      },
      writing: {
        prompt: "자기소개를 쓰세요.", hint: "", targetWords: ["저"],
        sourceRef: "book:p6:writing-section",
        promptSourceRef: "book:p6:writing-prompt",
        targetWordSourceRefs: ["book:p6:writing-target-0"],
      },
    };
    const report = auditLessonPracticeCoverage(itemLesson, [
      question("q-title", "book:p5:reading-title"),
      question("q-text", "book:p5:reading-text"),
      question("q-prompt", "book:p6:writing-prompt"),
      question("q-target", "book:p6:writing-target-0"),
    ]);
    expect(report.sourceItems).toBe(4);
    expect(report.verifiedItems).toBe(4);
    expect(report.complete).toBe(true);
  });

  it("uses item-level refs for pronunciation examples", () => {
    const itemLesson: LessonContent = {
      ...lesson,
      vocabulary: [],
      grammar: [],
      pronunciation: [{
        id: "pron1", title: "발음", explanation: "",
        examples: ["학교"], sourceRef: "book:p7:pronunciation-section",
        exampleSourceRefs: ["book:p7:pronunciation-example-0"],
      }],
    };
    const report = auditLessonPracticeCoverage(itemLesson, [
      question("q-pron", "book:p7:pronunciation-example-0"),
    ]);
    expect(report.sourceItems).toBe(1);
    expect(report.verifiedItems).toBe(1);
    expect(report.complete).toBe(true);
  });

  it("rejects another lesson's questions and absent evidence", () => {
    const report = auditLessonPracticeCoverage({ ...lesson, grammar: [] }, [
      { ...question("q", "book:p1:v1"), lessonId: 2 },
      question("q-no-ref"),
    ]);
    expect(report.verifiedItems).toBe(0);
  });
});
