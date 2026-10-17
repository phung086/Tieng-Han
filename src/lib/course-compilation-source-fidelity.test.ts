import { describe, expect, it } from "vitest";
import { getCompilationContract } from "@/lib/course-bundle";

const language = {
  target: "ko",
  learner: "vi",
  targetName: "Korean",
  learnerName: "Vietnamese",
  locale: "ko-KR",
  script: "hangul" as const,
};

describe("source-complete compilation contract", () => {
  const contract = getCompilationContract(language);

  it("does not cap or sample the number of lesson questions", () => {
    expect(contract.pedagogy.practiceVolume).toMatch(/do not use a fixed count/i);
    expect(contract.pedagogy.practiceVolume).toMatch(/every source item/i);
    expect(contract.pedagogy.practiceVolume).not.toMatch(/12\s*[-–]\s*20|\b\d+\s*[-–]\s*\d+%/);
    expect(contract.pedagogy.practiceBalance.join(" ")).not.toMatch(/\b\d+\s*[-–]\s*\d+%/);
  });

  it("preserves source items, original exercise motifs, and item-level evidence", () => {
    const principles = contract.principles.join(" ");
    expect(principles).toMatch(/inventory and preserve every source item/i);
    expect(principles).toMatch(/original exercise instruction and its motif/i);
    expect(principles).toMatch(/item-level anchors/i);
    expect(contract.pedagogy.reviewDesign.join(" ")).toMatch(/unique item anchor/i);
  });

  it("does not invent grading keys for ungradable source exercises", () => {
    expect(contract.pedagogy.practiceVolume).toMatch(/open-ended or ungradable/i);
    expect(contract.pedagogy.practiceVolume).toMatch(/instead of inventing answer keys/i);
    expect(contract.pedagogy.practiceVolume).toMatch(/never pad with unsupported content/i);
  });

  it("keeps the existing import checkpoint and bundle contract", () => {
    expect(contract.checkpointWorkflow).toEqual([
      "get_compilation_progress",
      "resume activeWork if present",
      "read_import_pages for the unfinished source range",
      "save_work_checkpoint after meaningful chunks",
      "compile and QA that lesson",
      "save_lesson_draft",
      "repeat only for unfinished lessons",
      "finalize_course_bundle",
    ]);
    expect(contract.runtimeSchema.StudyQuestion).toHaveProperty("answer", "string");
    expect(contract.runtimeSchema.LessonContent).toBeDefined();
  });
});
