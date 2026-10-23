import { describe, expect, it } from "vitest";
import { compareInventoryToPractice, type SourceInventoryItem, type PracticeQuestionEvidence } from "@/lib/source-inventory-parity";

const source: SourceInventoryItem[] = [
  { id: "word-1", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
  { id: "word-2", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
  { id: "exercise-1a", lessonId: 1, page: 11, kind: "exercise", motif: "reorder", verified: true },
];
const questions: PracticeQuestionEvidence[] = [
  { id: "q1", lessonId: 1, motif: "choice" },
  { id: "q2", lessonId: 1, motif: "choice" },
  { id: "q3", lessonId: 1, motif: "reorder" },
];
const link = (sourceItemId: string, questionId: string, motif?: string) =>
  ({ lessonId: 1, sourceItemId, questionId, motif });

describe("independent source inventory parity", () => {
  it("does not equate many questions about one word with complete coverage", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-1", "q2"), link("word-1", "q3"),
    ], questions);
    expect(result.sourceCount).toBe(3);
    expect(result.coveredCount).toBe(1);
    expect(result.missingIds).toEqual(["1:word-2", "1:exercise-1a"]);
    expect(result.complete).toBe(false);
  });

  it("checks the actual question motif, not only a caller-supplied motif claim", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-2", "q2"), link("exercise-1a", "q1", "reorder"),
    ], questions);
    expect(result.motifMismatchIds).toEqual(["1:exercise-1a"]);
    expect(result.complete).toBe(false);
  });

  it("requires verified pages, no duplicate IDs and no orphan source mappings", () => {
    const result = compareInventoryToPractice([
      ...source,
      { id: "word-2", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
      { id: "unclear", lessonId: 1, page: 12, kind: "reading", verified: false },
    ], [
      link("word-1", "q1"), link("word-2", "q2"),
      link("exercise-1a", "q3", "reorder"), link("not-in-book", "q1"),
    ], questions);
    expect(result.duplicateIds).toEqual(["1:word-2"]);
    expect(result.uncertainIds).toEqual(["1:unclear"]);
    expect(result.unknownReferences).toEqual(["1:not-in-book"]);
    expect(result.complete).toBe(false);
  });

  it("rejects dangling question IDs and question IDs from another lesson", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "missing-question"),
      link("word-2", "q2"),
      link("exercise-1a", "q3", "reorder"),
    ], [
      ...questions.filter(question => question.id !== "q1"),
      { id: "q1", lessonId: 2, motif: "choice" },
    ]);
    expect(result.danglingQuestionIds).toEqual(["1:missing-question"]);
    expect(result.missingIds).toEqual(["1:word-1"]);
    expect(result.coveredCount).toBe(2);
    expect(result.complete).toBe(false);
  });

  it("marks complete only when every verified item maps to a real question with the required motif", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-2", "q2"), link("exercise-1a", "q3", "reorder"),
    ], questions);
    expect(result.coveredCount).toBe(3);
    expect(result.complete).toBe(true);
  });

  it("cannot certify an empty inventory", () => {
    expect(compareInventoryToPractice([], [], []).complete).toBe(false);
  });
});
