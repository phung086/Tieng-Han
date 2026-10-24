import {
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  parseCourseBundle,
  type CompiledCourseBundle,
} from "@/lib/course-bundle";
import { defaultLanguageProfile } from "@/lib/language-profile";
import { auditCurriculumCoverage, CURRICULUM_AUDIT_VERSION } from "@/lib/curriculum-coverage";
import type { RuntimeCourse } from "@/lib/content-store";
import type { ImportJob } from "@/lib/import-jobs";
import { linkSourcePageMedia } from "@/lib/lesson-book";
import {
  requireImportJob,
  consumeImportJob,
  readImportPages,
  listImportJobs,
} from "@/lib/import-job-store";

export const activeCourseFilePath = process.env.HANEUL_ACTIVE_COURSE_FILE || path.join(
  process.cwd(),
  ".haneul",
  "active-course.json",
);

export const courseLibraryDir = process.env.HANEUL_COURSE_LIBRARY || path.join(
  process.cwd(),
  ".haneul",
  "courses",
);

type RuntimeEvidenceInput = Pick<RuntimeCourse, "title" | "level" | "source" | "lessons" | "questions">;

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => JSON.stringify(key) + ":" + stableSerialize(record[key]))
      .join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

/** Content-only digest used to safely backfill metadata without overwriting edited lessons. */
export function fingerprintRuntimeCourseContent(course: RuntimeEvidenceInput): string {
  return createHash("sha256").update(stableSerialize({
    title: course.title,
    level: course.level,
    lessons: course.lessons,
    questions: course.questions,
  })).digest("hex");
}

/** Deterministic integrity fingerprint over the current content and its source evidence. */
export function fingerprintRuntimeCourseEvidence(course: RuntimeEvidenceInput): string {
  return createHash("sha256").update(stableSerialize({
    content: fingerprintRuntimeCourseContent(course),
    edition: course.source?.edition ?? null,
    sourceFiles: course.source?.fileNames ?? (course.source?.fileName ? [course.source.fileName] : []),
    sourceManifest: course.source?.sourceManifest ?? null,
    sourceInventory: course.source?.sourceInventory ?? null,
  })).digest("hex");
}

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

  const runtimeCourse: RuntimeCourse = {
    id: "course-" + jobId,
    title: bundle.course.title.trim() || language.targetName,
    level: bundle.course.level.trim() || "General",
    language,
    source: {
      importJobId: jobId,
      fileName: sourceFiles[0],
      fileNames: sourceFiles,
      importedAt,
      pageCount: bundle.sourceManifest?.[0]?.pageCount,
      edition: bundle.course.edition,
      coverImageDataUrl,
      curriculumCoverage: auditCurriculumCoverage(bundle),
      sourceManifest: bundle.sourceManifest,
      sourceInventory: bundle.sourceInventory,
    },
    lessons: bundle.course.lessons,
    questions: bundle.course.questions,
  };
  if (runtimeCourse.source) {
    runtimeCourse.source.evidenceFingerprint = fingerprintRuntimeCourseEvidence(runtimeCourse);
  }
  return runtimeCourse;
}

async function buildRuntimeCourseForJob(job: ImportJob) {
  if (!job.resultBundle) {
    throw new Error("Import job không có resultBundle để nhập khóa học.");
  }

  const bundle = parseCourseBundle(JSON.stringify(job.resultBundle));
  const coverImageDataUrl = await readCoverImage(job.id);

  const course = buildRuntimeCourseFromBundle(
    job.id,
    bundle,
    coverImageDataUrl,
    job.updatedAt || job.createdAt,
  );
  const linkedCourse: RuntimeCourse = {
    ...course,
    lessons: course.lessons.map(lesson => linkSourcePageMedia(lesson, course.id, job.documents)),
  };
  if (linkedCourse.source) {
    linkedCourse.source.evidenceFingerprint = fingerprintRuntimeCourseEvidence(linkedCourse);
  }
  return linkedCourse;
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
    const entries = await readdir(/* turbopackIgnore: true */ courseLibraryDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const course = await readRuntimeCourseFile(
        path.join(/* turbopackIgnore: true */ courseLibraryDir, entry.name),
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
      const existing = byId.get(courseId);
      if (existing) {
        const needsEvidence = !existing.source?.sourceManifest?.length ||
          !existing.source.sourceInventory ||
          !existing.source.evidenceFingerprint ||
          existing.source.curriculumCoverage?.auditVersion !== CURRICULUM_AUDIT_VERSION ||
          existing.source.evidenceFingerprint !== fingerprintRuntimeCourseEvidence(existing);
        if (!needsEvidence) continue;

        try {
          const rebuilt = await buildRuntimeCourseForJob(job);
          // Never replace learner-visible content just to attach metadata.
          if (fingerprintRuntimeCourseContent(existing) !== fingerprintRuntimeCourseContent(rebuilt)) continue;
          const enriched: RuntimeCourse = {
            ...existing,
            source: {
              ...existing.source,
              importJobId: rebuilt.source?.importJobId ?? existing.source?.importJobId,
              fileName: rebuilt.source?.fileName ?? existing.source?.fileName,
              fileNames: rebuilt.source?.fileNames ?? existing.source?.fileNames,
              importedAt: existing.source?.importedAt ?? rebuilt.source?.importedAt,
              pageCount: rebuilt.source?.pageCount ?? existing.source?.pageCount,
              edition: rebuilt.source?.edition ?? existing.source?.edition,
              coverImageDataUrl: existing.source?.coverImageDataUrl ?? rebuilt.source?.coverImageDataUrl,
              curriculumCoverage: rebuilt.source?.curriculumCoverage,
              sourceManifest: rebuilt.source?.sourceManifest,
              sourceInventory: rebuilt.source?.sourceInventory,
              evidenceFingerprint: "",
            },
          };
          if (enriched.source) enriched.source.evidenceFingerprint = fingerprintRuntimeCourseEvidence(enriched);
          byId.set(courseId, enriched);
          await persistLibraryCourse(enriched);
        } catch {
          // Retain the existing course; publication remains blocked without current evidence.
        }
        continue;
      }

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
