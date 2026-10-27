import { describe, expect, it } from "vitest";
import {
  masteryPassed,
  pickBalancedQuestions,
} from "@/lib/study-session-plan";

describe("study session planning", () => {
  it("balances guided questions across skills before repeating a skill", () => {
    const items = [
      { id: "v1", skill: "vocabulary" },
      { id: "v2", skill: "vocabulary" },
      { id: "g1", skill: "grammar" },
      { id: "g2", skill: "grammar" },
      { id: "l1", skill: "listening" },
      { id: "s1", skill: "speaking" },
      { id: "r1", skill: "reading" },
      { id: "w1", skill: "writing" },
      { id: "v3", skill: "vocabulary" },
    ];

    const selected = pickBalancedQuestions(items, 8);

    expect(selected).toHaveLength(8);
    expect(selected.slice(0, 6).map((item) => item.skill)).toEqual([
      "vocabulary",
      "grammar",
      "listening",
      "speaking",
      "reading",
      "writing",
    ]);
  });

  it("keeps the full guided bank by default, including unknown skill buckets", () => {
    const items = [
      ...Array.from({ length: 25 }, (_, index) => ({
        id: "v" + index,
        skill: "vocabulary",
      })),
      { id: "g1", skill: "grammar" },
      { id: "g2", skill: "grammar" },
      { id: "p1", skill: "pronunciation" },
      { id: "c1", skill: "culture" },
    ];

    const selected = pickBalancedQuestions(items);

    expect(selected).toHaveLength(items.length);
    expect(new Set(selected.map((item) => item.id))).toEqual(
      new Set(items.map((item) => item.id)),
    );
    expect(selected.slice(0, 4).map((item) => item.skill)).toEqual([
      "vocabulary",
      "grammar",
      "pronunciation",
      "culture",
    ]);
  });

  it("uses a 75 percent mastery threshold", () => {
    expect(masteryPassed(3, 4)).toBe(true);
    expect(masteryPassed(2, 4)).toBe(false);
    expect(masteryPassed(0, 0)).toBe(false);
  });
});
