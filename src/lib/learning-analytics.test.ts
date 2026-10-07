import { describe, expect, it } from "vitest";
import {
  buildLearningAnalytics,
  type LearningAnalyticsState,
} from "@/lib/learning-analytics";

function state(
  overrides: Partial<LearningAnalyticsState> = {},
): LearningAnalyticsState {
  return {
    dailyGoal: 50,
    todayXp: 25,
    lessonProgress: {
      "1": 100,
      "2": 50,
    },
    skills: {
      vocabulary: { correct: 8, total: 10 },
      grammar: { correct: 3, total: 5 },
      listening: { correct: 0, total: 0 },
      speaking: { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
      writing: { correct: 0, total: 0 },
    },
    dailyStats: {
      "2026-10-06": { attempts: 4, correct: 3, xp: 30 },
      "2026-10-07": { attempts: 6, correct: 5, xp: 40 },
      "2026-09-30": { attempts: 5, correct: 3, xp: 24 },
    },
    mastery: {
      due: {
        strength: 45,
        lastReviewed: "2026-10-01",
        dueAt: "2026-10-07",
      },
      mastered: {
        strength: 90,
        lastReviewed: "2026-10-06",
        dueAt: "2026-10-14",
      },
    },
    ...overrides,
  };
}

describe("buildLearningAnalytics", () => {
  it("summarizes goals, weekly activity, mastery and lesson progress", () => {
    const analytics = buildLearningAnalytics(
      state(),
      "2026-10-07",
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"],
      ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"],
    );

    expect(analytics.goalPercent).toBe(50);
    expect(analytics.goalRemaining).toBe(25);
    expect(analytics.activeDays).toBe(2);
    expect(analytics.recentAttempts).toBe(10);
    expect(analytics.recentAccuracy).toBe(80);
    expect(analytics.previousAccuracy).toBe(60);
    expect(analytics.accuracyDelta).toBe(20);
    expect(analytics.averageLessonProgress).toBe(75);
    expect(analytics.completedLessons).toBe(1);
    expect(analytics.dueReviews).toBe(1);
    expect(analytics.fragileReviews).toBe(1);
    expect(analytics.masteredItems).toBe(1);
  });

  it("identifies strongest and weakest attempted skills", () => {
    const analytics = buildLearningAnalytics(
      state(),
      "2026-10-07",
      ["2026-10-07"],
      [],
    );

    expect(analytics.strongestSkill?.key).toBe("vocabulary");
    expect(analytics.strongestSkill?.accuracy).toBe(80);
    expect(analytics.weakestSkill?.key).toBe("grammar");
    expect(analytics.weakestSkill?.accuracy).toBe(60);
  });

  it("handles an empty learning history without inventing trends", () => {
    const empty = state({
      todayXp: 0,
      lessonProgress: {},
      skills: {
        vocabulary: { correct: 0, total: 0 },
        grammar: { correct: 0, total: 0 },
        listening: { correct: 0, total: 0 },
        speaking: { correct: 0, total: 0 },
        reading: { correct: 0, total: 0 },
        writing: { correct: 0, total: 0 },
      },
      dailyStats: {},
      mastery: {},
    });

    const analytics = buildLearningAnalytics(
      empty,
      "2026-10-07",
      ["2026-10-07"],
      ["2026-09-30"],
    );

    expect(analytics.recentAccuracy).toBe(0);
    expect(analytics.previousAccuracy).toBeNull();
    expect(analytics.accuracyDelta).toBeNull();
    expect(analytics.strongestSkill).toBeNull();
    expect(analytics.weakestSkill).toBeNull();
    expect(analytics.averageLessonProgress).toBe(0);
  });
});
