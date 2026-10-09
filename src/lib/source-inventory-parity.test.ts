import { describe, expect, it } from "vitest";
import { compareInventoryToPractice, type SourceInventoryItem } from "@/lib/source-inventory-parity";

const source: SourceInventoryItem[] = [
  { id: "word-1", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
  { id: "word-2", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
  { id: "exercise-1a", lessonId: 1, page: 11, kind: "exercise", motif: "reorder", verified: true },
];
const link = (sourceItemId: string, questionId: string, motif?: string) =>
  ({ lessonId: 1, sourceItemId, questionId, motif });

describe("independent source inventory parity", () => {
  it("does not equate many questions about one word with complete coverage", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-1", "q2"), link("word-1", "q3"),
    ]);
    expect(result.sourceCount).toBe(3);
    expect(result.coveredCount).toBe(1);
    expect(result.missingIds).toEqual(["1:word-2", "1:exercise-1a"]);
    expect(result.complete).toBe(false);
  });
  it("preserves exercise motif instead of accepting an unrelated question type", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-2", "q2"), link("exercise-1a", "q3", "choice"),
    ]);
    expect(result.motifMismatchIds).toEqual(["1:exercise-1a"]);
    expect(result.complete).toBe(false);
  });
  it("requires verified pages, no duplicate IDs and no orphan mappings", () => {
    const result = compareInventoryToPractice([
      ...source,
      { id: "word-2", lessonId: 1, page: 10, kind: "vocabulary", verified: true },
      { id: "unclear", lessonId: 1, page: 12, kind: "reading", verified: false },
    ], [
      link("word-1", "q1"), link("word-2", "q2"),
      link("exercise-1a", "q3", "reorder"), link("not-in-book", "q4"),
    ]);
    expect(result.duplicateIds).toEqual(["1:word-2"]);
    expect(result.uncertainIds).toEqual(["1:unclear"]);
    expect(result.unknownReferences).toEqual(["1:not-in-book"]);
    expect(result.complete).toBe(false);
  });
  it("marks complete only when every verified item has appropriate evidence", () => {
    const result = compareInventoryToPractice(source, [
      link("word-1", "q1"), link("word-2", "q2"), link("exercise-1a", "q3", "reorder"),
    ]);
    expect(result.coveredCount).toBe(3);
    expect(result.complete).toBe(true);
  });
  it("cannot certify an empty inventory", () => {
    expect(compareInventoryToPractice([], []).complete).toBe(false);
  });
});
