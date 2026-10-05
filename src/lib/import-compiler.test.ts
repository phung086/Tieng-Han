import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareImportCompilation } from "@/lib/import-compiler";
import {
  claimImportJob,
  getCompilationProgress,
  getImportJob,
} from "@/lib/import-job-store";

vi.mock("@/lib/import-job-store", () => ({
  claimImportJob: vi.fn(),
  getCompilationProgress: vi.fn(),
  getImportJob: vi.fn(),
}));

const baseJob = {
  format: "haneul-import-job",
  version: 1,
  id: "import-test-123",
  status: "queued",
  createdAt: "2026-10-05T00:00:00Z",
  updatedAt: "2026-10-05T00:00:00Z",
  language: {
    target: "ko",
    learner: "vi",
    targetName: "Tiếng Hàn",
    learnerName: "Tiếng Việt",
    locale: "ko-KR",
    script: "hangul",
  },
  courseHint: { title: "Book", level: "" },
  sourceManifest: [],
  documents: [],
  detectedMaps: [],
  uploadedPages: 1,
  totalPages: 1,
};

describe("prepareImportCompilation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompilationProgress).mockResolvedValue({
      completedLessonIds: [],
      lessonDrafts: [],
      activeWork: null,
    } as never);
  });

  it("claims a queued job and returns contract plus progress", async () => {
    vi.mocked(getImportJob).mockResolvedValue(baseJob as never);
    vi.mocked(claimImportJob).mockResolvedValue({
      ...baseJob,
      status: "processing",
    } as never);

    const result = await prepareImportCompilation(baseJob.id);

    expect(claimImportJob).toHaveBeenCalledWith(baseJob.id);
    expect(result.job.status).toBe("processing");
    expect(result.contract.runtimeSchema.LessonContent).toBeTruthy();
    expect(result.progress.completedLessonIds).toEqual([]);
    expect(result.nextAction).toContain("finalize_course_bundle");
  });

  it("does not claim an already-processing job", async () => {
    vi.mocked(getImportJob).mockResolvedValue({
      ...baseJob,
      status: "processing",
    } as never);

    const result = await prepareImportCompilation(baseJob.id);

    expect(claimImportJob).not.toHaveBeenCalled();
    expect(result.job.status).toBe("processing");
  });

  it("refuses jobs that are still uploading", async () => {
    vi.mocked(getImportJob).mockResolvedValue({
      ...baseJob,
      status: "uploading",
    } as never);

    await expect(
      prepareImportCompilation(baseJob.id),
    ).rejects.toThrow("chưa sẵn sàng");
  });
});
