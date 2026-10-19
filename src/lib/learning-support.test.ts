import { describe, expect, it } from "vitest";
import { course, studyQuestions } from "@/lib/testing/study-fixture";
import { answersMatch, availableTokenIndexes } from "@/lib/answer-check";
import { findCoachEvidence } from "@/lib/lesson-coach";
import { speechMatchScore } from "@/lib/speech-match";
import { writingChecks } from "@/lib/writing-rubric";

const book = { ...course, questions: studyQuestions };
describe("source-grounded study support", () => {
  it("retrieves an exact Korean word with its original example", () => {
    const result = findCoachEvidence(book, 3, "학교");
    expect(result[0]).toMatchObject({ id: "v-school", text: "trường học" });
    expect(result[0].examples).toContain("저는 학교에 갑니다.");
  });
  it("explains the checked question from its stored explanation", () => {
    expect(findCoachEvidence(book, 3, "Giải thích câu vừa làm", "g-3-1")[0].text).toBe(studyQuestions.find(item => item.id === "g-3-1")?.explanation);
  });
  it("finds one-syllable Korean words even with question punctuation", () => {
    expect(findCoachEvidence(book, 3, "집?")[0]).toMatchObject({ id: "v-home", text: "nhà" });
  });
  it("does not invent material or search another lesson", () => {
    expect(findCoachEvidence(book, 3, "quantummechanics")).toEqual([]);
    expect(findCoachEvidence(book, 1, "학교")).toEqual([]);
  });
  it("handles Korean composed and decomposed text equivalently", () => {
    expect(answersMatch("학교".normalize("NFD"), "학교")).toBe(true);
    expect(answersMatch(" Tôi đi học. ", "tôi đi học")).toBe(true);
  });
  it("keeps identical reorder tokens individually selectable", () => {
    expect(availableTokenIndexes(["학교", "에", "학교", "에"], [0, 1])).toEqual([2, 3]);
  });
  it("does not treat scrambled characters or repeated syllables as perfect speech", () => {
    expect(speechMatchScore("학교에 갑니다.", "학교에 갑니다")).toBe(100);
    expect(speechMatchScore("다니갑에교학", "학교에갑니다")).toBeLessThan(75);
    expect(speechMatchScore("학학학학학학", "학교에갑니다")).toBeLessThan(75);
  });
  it("does not impose location particles on an introduction writing task", () => {
    const lesson = { ...course.lessons[2], grammar: [{ id: "intro", pattern: "입니다", meaning: "là", explanation: "", examples: ["저는 학생입니다."] }], writing: { prompt: "Viết 2 câu tự giới thiệu.", hint: "Sử dụng 입니다.", targetWords: ["학생"] } };
    const checks = writingChecks("저는 학생입니다. 저는 베트남 사람입니다.", lesson);
    expect(checks.every(item => item.passed)).toBe(true);
    expect(checks.some(item => /에 \/ 에서/.test(item.label))).toBe(false);
  });
});
