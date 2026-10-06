import {
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
} from "node:fs/promises";
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

export const courseLibraryDir = path.join(
  process.cwd(),
  ".haneul",
  "courses",
);

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, filePath);
}

function isRuntimeCourse(value: unknown): value is RuntimeCourse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.level === "string" &&
    Array.isArray(record.lessons) &&
    Array.isArray(record.questions)
  );
}

function libraryFilePath(courseId: string) {
  return path.join(courseLibraryDir, courseId + ".json");
}

async function readRuntimeCourseFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isRuntimeCourse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readCoverImage(jobId: string) {
  try {
    const firstPages = await readImportPages({
      jobId,
      startPage: 1,
      endPage: 1,
      limit: 1,
    });
    return firstPages[0]?.previewImageDataUrl;
  } catch {
    return undefined;
  }
}

export function buildRuntimeCourseFromBundle(
  jobId: string,
  bundle: CompiledCourseBundle,
  coverImageDataUrl?: string,
  importedAt = new Date().toISOString(),
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
      importedAt,
      pageCount: bundle.sourceManifest?.[0]?.pageCount,
      edition: bundle.course.edition,
      coverImageDataUrl,
    },
    lessons: bundle.course.lessons,
    questions: bundle.course.questions,
  };
}

async function buildRuntimeCourseForJob(job: ImportJob) {
  if (!job.resultBundle) {
    throw new Error("Import job không có resultBundle để nhập khóa học.");
  }

  const bundle = parseCourseBundle(JSON.stringify(job.resultBundle));
  const coverImageDataUrl = await readCoverImage(job.id);

  return buildRuntimeCourseFromBundle(
    job.id,
    bundle,
    coverImageDataUrl,
    job.updatedAt || job.createdAt,
  );
}

async function persistLibraryCourse(course: RuntimeCourse) {
  await writeJsonAtomic(libraryFilePath(course.id), course);
}

export async function consumeReadyImportJob(jobId: string): Promise<{
  job: ImportJob;
  course: RuntimeCourse;
}> {
  const job = await requireImportJob(jobId);

  if (job.status !== "ready" && job.status !== "consumed") {
    throw new Error(
      `Import job chưa ở trạng thái ready để nhập vào khóa học (trạng thái hiện tại: ${job.status}).`,
    );
  }

  let runtimeCourse = await readRuntimeCourseFile(
    libraryFilePath("course-" + jobId),
  );

  if (!runtimeCourse) {
    runtimeCourse = await buildRuntimeCourseForJob(job);
    await persistLibraryCourse(runtimeCourse);
  }

  // Keep active-course.json for backward compatibility with existing routes.
  await writeJsonAtomic(activeCourseFilePath, runtimeCourse);

  const updatedJob =
    job.status === "consumed" ? job : await consumeImportJob(jobId);

  return { job: updatedJob, course: runtimeCourse };
}

export async function getCourseLibrary(): Promise<RuntimeCourse[]> {
  await mkdir(courseLibraryDir, { recursive: true });

  const byId = new Map<string, RuntimeCourse>();

  try {
    const entries = await readdir(courseLibraryDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const course = await readRuntimeCourseFile(
        path.join(courseLibraryDir, entry.name),
      );
      if (course) byId.set(course.id, course);
    }
  } catch {
    // Continue with migration sources.
  }

  // Preserve the legacy active course if it predates the library directory.
  const legacyActive = await readRuntimeCourseFile(activeCourseFilePath);
  if (legacyActive && !byId.has(legacyActive.id)) {
    byId.set(legacyActive.id, legacyActive);
    await persistLibraryCourse(legacyActive);
  }

  // Migrate every previously consumed import job into the course library.
  // This restores Sơ cấp 1 and Sơ cấp 2 without requiring a re-import.
  try {
    const jobs = await listImportJobs();

    for (const job of jobs) {
      if (job.status !== "consumed" || !job.resultBundle) continue;

      const courseId = "course-" + job.id;
      if (byId.has(courseId)) continue;

      try {
        const course = await buildRuntimeCourseForJob(job);
        byId.set(course.id, course);
        await persistLibraryCourse(course);
      } catch {
        // One malformed historical job must not hide the rest of the library.
      }
    }
  } catch {
    // The library can still operate from persisted course files.
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = a.source?.importedAt
      ? new Date(a.source.importedAt).getTime()
      : 0;
    const bTime = b.source?.importedAt
      ? new Date(b.source.importedAt).getTime()
      : 0;
    return bTime - aTime;
  });
}

export async function getActiveCourse(): Promise<RuntimeCourse | null> {
  const active = await readRuntimeCourseFile(activeCourseFilePath);
  if (active) return active;

  const library = await getCourseLibrary();
  if (library.length) return library[0];

  // Backward-compatible recovery for an unconsumed ready job.
  try {
    const jobs = await listImportJobs();
    const ready = jobs.find((job) => job.status === "ready" && job.resultBundle);
    if (ready) {
      const result = await consumeReadyImportJob(ready.id);
      return result.course;
    }
  } catch {
    // No recoverable course.
  }

  return null;
}
