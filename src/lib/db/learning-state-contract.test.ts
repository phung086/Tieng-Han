import { describe, expect, it } from "vitest";
import { learningStateSchema } from "@/lib/db/learning-state-contract";

function validState() {
  return {
    version: 2 as const,
    xp: 120,
    streak: 3,
    dailyGoal: 50,
    todayXp: 20,
    lastActiveDate: "2026-10-07",
    lessonProgress: { "1": 50 },
    skills: {
      vocabulary: { correct: 4, total: 5 },
      grammar: { correct: 3, total: 5 },
      listening: { correct: 2, total: 4 },
      speaking: { correct: 1, total: 2 },
      reading: { correct: 3, total: 3 },
      writing: { correct: 1, total: 3 },
    },
    completedActivities: ["lesson:1:vocabulary"],
    dailyStats: {
      "2026-10-07": { attempts: 5, correct: 4, xp: 20 },
    },
    mastery: {},
  };
}

describe("learning-state integrity", () => {
  it("accepts semantically consistent counters", () => {
    expect(learningStateSchema.safeParse(validState()).success).toBe(true);
  });

  it("rejects a skill with more correct answers than attempts", () => {
    const state = validState();
    state.skills.vocabulary = { correct: 6, total: 5 };

    expect(learningStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects daily stats with more correct answers than attempts", () => {
    const state = validState();
    state.dailyStats["2026-10-07"] = {
      attempts: 5,
      correct: 6,
      xp: 20,
    };

    expect(learningStateSchema.safeParse(state).success).toBe(false);
  });
});
