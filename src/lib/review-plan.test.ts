import { describe, expect, it } from "vitest";
import { course, studyQuestions } from "@/data/content";
import { createLearningState } from "@/lib/learning-model";
import { buildReviewCatalog, reviewSummary, selectReviewQuestions } from "@/lib/review-plan";
import type { RuntimeCourse } from "@/lib/content-store";
const book: RuntimeCourse = { ...course, questions: studyQuestions };

describe("targeted review planning", () => {
  it("keeps unseen and removed items out of the queue", () => {
    const state = createLearningState();
    state.mastery.removed = { strength: 0, dueAt: "2026-01-01", lastReviewed: "2026-01-01" };
    expect(reviewSummary(book, state, "2026-10-06").due).toEqual([]);
  });
  it("prioritizes overdue items before newly due items and freezes at ten", () => {
    const state = createLearningState(); const catalog = buildReviewCatalog(book);
    for (const [index, item] of catalog.entries()) state.mastery[item.id] = { strength: index % 2 ? 15 : 80, dueAt: index === 0 ? "2026-10-01" : "2026-10-06", lastReviewed: "2026-09-30" };
    const selected = selectReviewQuestions(book, state, "2026-10-06");
    expect(selected).toHaveLength(10); expect(selected[0].id).toBe(catalog[0].id);
  });
  it("opens only the exact learned item when the learner selects one", () => {
    const state = createLearningState();
    state.mastery["v-school"] = { strength: 50, dueAt: "2026-10-07", lastReviewed: "2026-10-06" };
    expect(selectReviewQuestions(book, state, "2026-10-06", "v-school").map(item => item.id)).toEqual(["v-school"]);
    expect(selectReviewQuestions(book, state, "2026-10-06", "v-company")).toEqual([]);
    expect(selectReviewQuestions(book, state, "2026-10-06")).toEqual([]);
  });
  it("provides source reading context and explicit self-assessment modes", () => {
    const catalog = buildReviewCatalog(book);
    expect(catalog.find(item => item.id === "read-1")?.context).toContain("민수");
    expect(catalog.find(item => item.id === "v-school")?.reviewKind).toBe("recall");
    expect(catalog.find(item => item.id === "speak-3-0")?.reviewKind).toBe("speaking");
  });
});
