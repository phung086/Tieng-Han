import { describe, expect, it } from "vitest";
import { advanceMastery, nextReviewIntervalDays } from "@/lib/review-schedule";

describe("nextReviewIntervalDays", () => {
  it("does not inflate mastery or postpone the review by repeating correct answers today", () => {
    const initial = advanceMastery(undefined, true, "2026-10-06");
    expect(advanceMastery(initial, true, "2026-10-06")).toBe(initial);
    expect(advanceMastery(initial, true, "2026-10-07").strength).toBe(65);
  });
  it("keeps a corrected mistake on a short schedule", () => {
    const wrong = advanceMastery({ strength: 95, lastReviewed: "2026-10-01", dueAt: "2026-10-06" }, false, "2026-10-06");
    expect(wrong.dueAt).toBe("2026-10-06");
    const corrected = advanceMastery(wrong, true, "2026-10-06");
    expect(corrected.dueAt).toBe("2026-10-07");
  });
  it("schedules across a year boundary", () => {
    expect(advanceMastery(undefined, true, "2026-12-31").dueAt).toBe("2027-01-01");
  });
  it("reviews wrong answers again today", () => {
    expect(nextReviewIntervalDays(90, false)).toBe(0);
  });

  it("starts new knowledge with a short interval", () => {
    expect(nextReviewIntervalDays(50, true)).toBe(1);
  });

  it("widens intervals as mastery grows", () => {
    expect(nextReviewIntervalDays(65, true)).toBe(3);
    expect(nextReviewIntervalDays(80, true)).toBe(7);
    expect(nextReviewIntervalDays(90, true)).toBe(14);
    expect(nextReviewIntervalDays(100, true)).toBe(30);
  });
});
