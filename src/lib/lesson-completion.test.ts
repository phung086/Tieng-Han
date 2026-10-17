import { describe, expect, it } from "vitest";
import {
  getCoreLessonProgress,
  getRequiredCoreSkills,
  isLessonCoreComplete,
  lessonSkillActivityId,
} from "@/lib/lesson-completion";

describe("lesson core completion", () => {
  it("requires vocabulary and grammar by default", () => {
    const completed = [
      lessonSkillActivityId(3, "vocabulary"),
      lessonSkillActivityId(3, "grammar"),
    ];

    expect(getCoreLessonProgress(completed, 3)).toBe(100);
    expect(isLessonCoreComplete(completed, 3)).toBe(true);
  });

  it("does not require optional speaking, reading or writing", () => {
    const completed = [
      lessonSkillActivityId(4, "vocabulary"),
      lessonSkillActivityId(4, "grammar"),
    ];

    expect(isLessonCoreComplete(completed, 4)).toBe(true);
  });

  it("reports half progress when only one core skill is complete", () => {
    const completed = [lessonSkillActivityId(2, "vocabulary")];

    expect(getCoreLessonProgress(completed, 2)).toBe(50);
    expect(isLessonCoreComplete(completed, 2)).toBe(false);
  });

  it("adapts when an imported lesson lacks one core section", () => {
    const required = getRequiredCoreSkills({
      hasVocabulary: true,
      hasGrammar: false,
    });

    expect(required).toEqual(["vocabulary"]);
    expect(
      isLessonCoreComplete(
        [lessonSkillActivityId(7, "vocabulary")],
        7,
        required,
      ),
    ).toBe(true);
  });
});
