import { describe, expect, it } from "vitest";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

describe("lesson flow", () => {
  it("keeps vocabulary -> grammar as the required core path", () => {
    expect(getNextLessonFlowStep(3, "vocabulary")).toMatchObject({
      skill: "grammar",
      label: "Ngữ pháp",
      href: "/grammar?lesson=3",
    });
  });

  it("returns to the lesson hub after grammar instead of forcing listening", () => {
    expect(getNextLessonFlowStep(3, "grammar")).toEqual({
      skill: "lesson",
      label: "Xong phần cốt lõi",
      href: "/learn/3",
    });
  });

  it("keeps optional skills navigable when the learner chooses them", () => {
    expect(getNextLessonFlowStep(3, "listening")).toMatchObject({
      skill: "speaking",
      label: "Nói (tùy chọn)",
      href: "/speaking?lesson=3",
    });
    expect(getNextLessonFlowStep(3, "reading")).toMatchObject({
      skill: "writing",
      label: "Viết (tùy chọn)",
      href: "/writing?lesson=3",
    });
  });

  it("ends optional writing with mastery", () => {
    expect(getNextLessonFlowStep(7, "writing")).toEqual({
      skill: "mastery",
      label: "Mastery Check",
      href: "/practice/quiz?lesson=7&mode=mastery",
    });
  });
});
