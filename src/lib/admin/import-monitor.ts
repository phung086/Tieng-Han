import {
  getCompilationProgress,
  listImportJobs,
} from "@/lib/import-job-store";
import type { ImportJobStatus } from "@/lib/import-jobs";

export type AdminImportJobSummary = {
  id: string;
  status: ImportJobStatus;
  title: string;
  level: string;
  sourceFiles: string[];
  uploadedPages: number;
  totalPages: number;
  createdAt: string;
  updatedAt: string;
  completedLessonIds: number[];
  detectedLessonCount: number;
  pendingDetectedLessonCount: number;
  activeWork: Array<{
    lessonId: number;
    phase: "source-reading" | "drafting" | "qa";
    savedAt: string;
    pageNumber?: number;
  }>;
  error?: string;
};

export async function getAdminImportJobs(
  limit = 16,
): Promise<AdminImportJobSummary[]> {
  const jobs = (await listImportJobs()).slice(
    0,
    Math.max(1, Math.min(50, limit)),
  );

  return Promise.all(
    jobs.map(async (job) => {
      let progress:
        | Awaited<ReturnType<typeof getCompilationProgress>>
        | null = null;

      try {
        progress = await getCompilationProgress(job.id);
      } catch {
        // A damaged progress checkpoint must not hide the job itself.
      }

      return {
        id: job.id,
        status: job.status,
        title: job.courseHint.title,
        level: job.courseHint.level,
        sourceFiles: job.sourceManifest.map((source) => source.name),
        uploadedPages: job.uploadedPages,
        totalPages: job.totalPages,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedLessonIds: progress?.completedLessonIds ?? [],
        detectedLessonCount:
          progress?.detectedCandidates.length ?? 0,
        pendingDetectedLessonCount:
          progress?.pendingDetectedLessonIds.length ?? 0,
        activeWork:
          progress?.activeWork.map((work) => ({
            lessonId: work.lessonId,
            phase: work.phase,
            savedAt: work.savedAt,
            pageNumber: work.sourceCursor?.pageNumber,
          })) ?? [],
        error: job.error,
      };
    }),
  );
}
