import { describe, expect, it } from "vitest";
import { nextReviewIntervalDays } from "@/lib/review-schedule";

describe("nextReviewIntervalDays", () => {
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
