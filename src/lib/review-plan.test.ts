import { describe, expect, it } from "vitest";
import { course, studyQuestions } from "@/lib/testing/study-fixture";
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
  it("prioritizes overdue items without silently limiting the learned catalog", () => {
    const state = createLearningState(); const catalog = buildReviewCatalog(book);
    for (const [index, item] of catalog.entries()) state.mastery[item.id] = { strength: index % 2 ? 15 : 80, dueAt: index === 0 ? "2026-10-01" : "2026-10-06", lastReviewed: "2026-09-30" };
    const selected = selectReviewQuestions(book, state, "2026-10-06");
    expect(selected).toHaveLength(catalog.length); expect(selected[0].id).toBe(catalog[0].id);
  });
  it("opens only the exact learned item when the learner selects one", () => {
    const state = createLearningState();
    state.mastery["v-school"] = { strength: 50, dueAt: "2026-10-07", lastReviewed: "2026-10-06" };
    expect(selectReviewQuestions(book, state, "2026-10-06", "v-school").map(item => item.id)).toEqual(["v-school"]);
    expect(selectReviewQuestions(book, state, "2026-10-06", "v-company")).toEqual([]);
    expect(selectReviewQuestions(book, state, "2026-10-06")).toEqual([]);
  });
  it("does not promote parent section refs to item-level review evidence", () => {
    const sourceLesson = {
      id: 88,
      title: "제88과",
      vi: "Bài 88",
      objective: "Kiểm thử nguồn",
      sourceRef: "parent-only.pdf · p.1",
      vocabulary: [{ id: "v88", ko: "학교", vi: "trường học", example: "" }],
      grammar: [],
      listening: [{
        id: "listen88", text: "어디입니까?", meaning: "Ở đâu?",
        choices: ["학교", "병원"], answer: "학교",
      }],
      speaking: ["안녕하세요."],
      reading: {
        title: "읽기", text: "학교에 갑니다.", translation: "Tôi đi đến trường.",
        questions: [{ id: "read88", q: "어디에 갑니까?", choices: ["학교", "병원"], answer: "학교" }],
        sourceRef: "parent-only.pdf · p.2",
      },
      writing: { prompt: "Viết câu", hint: "학교에 갑니다.", targetWords: ["학교"] },
    } satisfies RuntimeCourse["lessons"][number];
    const catalog = buildReviewCatalog({ ...book, lessons: [sourceLesson], questions: [] });
    for (const id of ["v88", "listen88", "speak-88-0", "read88", "writing-88"]) {
      expect(catalog.find(item => item.id === id)?.sourceRef).toBeUndefined();
    }
  });
  it("uses speaking item refs only when the bundle carries an aligned verified ref", () => {
    const sourceLesson = {
      ...book.lessons[0],
      id: 89,
      sourceRef: "parent-only.pdf · p.1",
      speaking: ["안녕하세요.", "감사합니다."],
      speakingSourceRefs: ["book.pdf · p.12 · speaking-1", null],
    } satisfies RuntimeCourse["lessons"][number];
    const catalog = buildReviewCatalog({ ...book, lessons: [sourceLesson], questions: [] });
    expect(catalog.find(item => item.id === "speak-89-0")?.sourceRef)
      .toBe("book.pdf · p.12 · speaking-1");
    expect(catalog.find(item => item.id === "speak-89-1")?.sourceRef).toBeUndefined();
  });

  it("provides source reading context and explicit self-assessment modes", () => {
    const catalog = buildReviewCatalog(book);
    expect(catalog.find(item => item.id === "read-1")?.context).toContain("민수");
    expect(catalog.find(item => item.id === "v-school")?.reviewKind).toBe("recall");
    expect(catalog.find(item => item.id === "speak-3-0")?.reviewKind).toBe("speaking");
  });
});
