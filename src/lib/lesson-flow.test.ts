import { describe, expect, it } from "vitest";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

describe("lesson flow", () => {
  it("moves learners through all six skills in order", () => {
    expect(getNextLessonFlowStep(3, "vocabulary")).toMatchObject({
      skill: "grammar",
      href: "/grammar?lesson=3",
    });
    expect(getNextLessonFlowStep(3, "grammar")).toMatchObject({
      skill: "listening",
      href: "/listening?lesson=3",
    });
    expect(getNextLessonFlowStep(3, "speaking")).toMatchObject({
      skill: "reading",
      href: "/reading?lesson=3",
    });
  });

  it("ends the six-skill flow with mastery", () => {
    expect(getNextLessonFlowStep(7, "writing")).toEqual({
      skill: "mastery",
      label: "Mastery Check",
      href: "/practice/quiz?lesson=7&mode=mastery",
    });
  });
});
