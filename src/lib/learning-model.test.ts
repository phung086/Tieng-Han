import { describe, expect, it } from "vitest";
import { ALL_SKILLS, activateLearningDay, completeLearningMastery, completeLearningSkill, createLearningState, normalizeLessonProgress, recordLearningAnswer, refreshLearningDay } from "@/lib/learning-model";

describe("learning progress", () => {
  it("requires all six stages and a full mastery check before reaching 100%", () => {
    let state = createLearningState();
    expect(completeLearningMastery(state, 1)).toBe(state);
    for (const skill of ALL_SKILLS) state = completeLearningSkill(state, 1, skill);
    expect(state.lessonProgress[1]).toBe(86);
    state = completeLearningMastery(state, 1);
    expect(state.lessonProgress[1]).toBe(100);
    expect(completeLearningMastery(state, 1).xp).toBe(state.xp);
  });
  it("does not award stage completion XP twice", () => {
    const state = completeLearningSkill(createLearningState(), 2, "grammar");
    expect(completeLearningSkill(state, 2, "grammar").xp).toBe(state.xp);
  });
  it("preserves old skills while requiring the final check for legacy 100%", () => {
    const state = createLearningState();
    state.lessonProgress[1] = 100;
    state.completedActivities = ALL_SKILLS.map(skill => `lesson:1:${skill}`);
    const normalized = normalizeLessonProgress(state);
    expect(normalized.completedActivities).toEqual(state.completedActivities);
    expect(normalized.lessonProgress[1]).toBe(86);
  });
  it("clears yesterday's daily XP without erasing total XP", () => {
    const state = { ...createLearningState(), xp: 100, todayXp: 40, lastActiveDate: "2026-10-05", streak: 4 };
    const next = refreshLearningDay(state, new Date(2026, 9, 6, 12));
    expect(next).toMatchObject({ xp: 100, todayXp: 0, streak: 4 });
    expect(activateLearningDay(next, new Date(2026, 9, 6, 12)).state.streak).toBe(5);
  });
  it("ends an expired streak without manufacturing a new active day", () => {
    const state = { ...createLearningState(), lastActiveDate: "2026-10-02", streak: 4 };
    expect(refreshLearningDay(state, new Date(2026, 9, 6, 12))).toMatchObject({ streak: 0, lastActiveDate: "2026-10-02" });
  });
  it("records a wrong answer as an item to review today", () => {
    const state = recordLearningAnswer(createLearningState(), "grammar", false, "question-1", new Date(2026, 9, 6, 12));
    expect(state.mastery["question-1"]).toMatchObject({ dueAt: "2026-10-06", lastResult: false });
    expect(state.skills.grammar).toEqual({ correct: 0, total: 1 });
    expect(state.completedActivities).not.toContain("question-1");
  });
});
