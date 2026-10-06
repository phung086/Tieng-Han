import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseCourseBundle,
  type CompiledCourseBundle,
} from "@/lib/course-bundle";
import { defaultLanguageProfile } from "@/lib/language-profile";
import type { RuntimeCourse } from "@/lib/content-store";
import type { ImportJob } from "@/lib/import-jobs";
import {
  requireImportJob,
  consumeImportJob,
  readImportPages,
  listImportJobs,
} from "@/lib/import-job-store";

export const activeCourseFilePath = path.join(
  process.cwd(),
  ".haneul",
  "active-course.json",
);

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, filePath);
}

export function buildRuntimeCourseFromBundle(
  jobId: string,
  bundle: CompiledCourseBundle,
  coverImageDataUrl?: string,
): RuntimeCourse {
  const sourceFiles = bundle.sourceFiles ?? [];
  const language = bundle.language ?? defaultLanguageProfile;
  return {
    id: "course-" + jobId,
    title: bundle.course.title.trim() || language.targetName,
    level: bundle.course.level.trim() || "General",
    language,
    source: {
      fileName: sourceFiles[0],
      fileNames: sourceFiles,
      importedAt: new Date().toISOString(),
      pageCount: bundle.sourceManifest?.[0]?.pageCount,
      edition: bundle.course.edition,
      coverImageDataUrl,
    },
    lessons: bundle.course.lessons,
    questions: bundle.course.questions,
  };
}

export async function consumeReadyImportJob(jobId: string): Promise<{
  job: ImportJob;
  course: RuntimeCourse;
}> {
  const job = await requireImportJob(jobId);

  // If already consumed, reuse the persisted course only when it belongs
  // to this exact import job. Otherwise rebuild it from this job's bundle.
  if (job.status === "consumed") {
    try {
      const existingRaw = await readFile(activeCourseFilePath, "utf8");
      const existing = JSON.parse(existingRaw) as RuntimeCourse;
      if (
        existing?.id === "course-" + jobId &&
        Array.isArray(existing.lessons) &&
        existing.lessons.length > 0
      ) {
        return { job, course: existing };
      }
    } catch {
      // Re-create from job resultBundle if needed
    }
  }

  if (job.status !== "ready" && job.status !== "consumed") {
    throw new Error(
      `Import job chưa ở trạng thái ready để nhập vào khóa học (trạng thái hiện tại: ${job.status}).`,
    );
  }

  if (!job.resultBundle) {
    throw new Error("Import job không có resultBundle để nhập khóa học.");
  }

  // 1. Validate resultBundle
  const bundle = parseCourseBundle(JSON.stringify(job.resultBundle));

  // 2. Extract cover image from page 1 if available
  let coverImageDataUrl: string | undefined;
  try {
    const firstPages = await readImportPages({
      jobId,
      startPage: 1,
      endPage: 1,
      limit: 1,
    });
    if (firstPages[0]?.previewImageDataUrl) {
      coverImageDataUrl = firstPages[0].previewImageDataUrl;
    }
  } catch {
    // Media preview is optional
  }

  // 3. Build RuntimeCourse
  const runtimeCourse = buildRuntimeCourseFromBundle(
    jobId,
    bundle,
    coverImageDataUrl,
  );

  // 4. Atomically persist learner-facing course data
  await writeJsonAtomic(activeCourseFilePath, runtimeCourse);

  // 5. Update job status to consumed only after persistence succeeds
  const updatedJob =
    job.status === "consumed" ? job : await consumeImportJob(jobId);

  return { job: updatedJob, course: runtimeCourse };
}

export async function getActiveCourse(): Promise<RuntimeCourse | null> {
  // Check active course file first
  try {
    const raw = await readFile(activeCourseFilePath, "utf8");
    const parsed = JSON.parse(raw) as RuntimeCourse;
    if (parsed && Array.isArray(parsed.lessons) && parsed.lessons.length > 0) {
      return parsed;
    }
  } catch {
    // Continue to check import jobs
  }

  // If not persisted yet, find any ready or consumed import job
  try {
    const jobs = await listImportJobs();
    const readyOrConsumed = jobs.find(
      (j) => (j.status === "ready" || j.status === "consumed") && j.resultBundle,
    );
    if (readyOrConsumed) {
      const result = await consumeReadyImportJob(readyOrConsumed.id);
      return result.course;
    }
  } catch {
    // No jobs found
  }

  return null;
}
