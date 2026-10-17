import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { publishImportJobQueued } from "@/lib/mcp-events";
import { sameSourceManifest, validateImportDocuments, validateImportPage } from "@/lib/source-integrity";
import { auditLessonPracticeCoverage } from "@/lib/practice-coverage";
import { summarizeLessonPractice } from "@/lib/lesson-practice-bank";
import { auditCurriculumCoverage, sourceInventorySchema } from "@/lib/curriculum-coverage";
import {
  COURSE_BUNDLE_FORMAT,
  COURSE_BUNDLE_VERSION,
  parseCourseBundle,
  type CompiledCourseBundle,
} from "@/lib/course-bundle";
import type { LessonContent, StudyQuestion } from "@/data/content";
import {
  IMPORT_JOB_FORMAT,
  IMPORT_JOB_VERSION,
  type CreateImportJobInput,
  type ImportJob,
  type ImportJobPage,
  type ImportJobStatus,
  canDeleteImportJob,
} from "@/lib/import-jobs";

const rootDir =
  process.env.HANEUL_IMPORT_DIR ||
  path.join(process.cwd(), ".haneul", "import-jobs");

// Serialize read/mutate/write within one server process. This does not replace
// cross-process worker leases, which are still a separate deployment concern.
const jobWrites = new Map<string, Promise<void>>();
function sameBundle(left: unknown, right: unknown) {
  if (left === undefined || right === undefined) return left === right;
  return isDeepStrictEqual(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));
}

function assertSafeId(jobId: string) {
  if (!/^[a-z0-9-]{8,80}$/i.test(jobId)) {
    throw new Error("Import job id không hợp lệ.");
  }
}

function jobDir(jobId: string) {
  assertSafeId(jobId);
  return path.join(/* turbopackIgnore: true */ rootDir, jobId);
}

function jobFile(jobId: string) {
  return path.join(jobDir(jobId), "job.json");
}

function pagesDir(jobId: string) {
  return path.join(jobDir(jobId), "pages");
}

function draftsDir(jobId: string) {
  return path.join(jobDir(jobId), "drafts");
}

function assertLessonId(lessonId: number) {
  if (!Number.isSafeInteger(lessonId) || lessonId < 1) {
    throw new Error("lessonId không hợp lệ.");
  }
}

function lessonDraftFile(jobId: string, lessonId: number) {
  assertLessonId(lessonId);

  return path.join(
    draftsDir(jobId),
    "lesson-" + String(lessonId).padStart(5, "0") + ".json",
  );
}

function workCheckpointFile(jobId: string, lessonId: number) {
  assertLessonId(lessonId);

  return path.join(
    draftsDir(jobId),
    "work-" + String(lessonId).padStart(5, "0") + ".json",
  );
}

function pageFile(jobId: string, page: Pick<ImportJobPage, "documentId" | "pageNumber">) {
  if (!/^[a-z0-9_-]{1,80}$/i.test(page.documentId)) {
    throw new Error("documentId không hợp lệ.");
  }
  const pageNumber = Number(page.pageNumber);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    throw new Error("pageNumber không hợp lệ.");
  }

  return path.join(
    pagesDir(jobId),
    page.documentId + "-" + String(pageNumber).padStart(5, "0") + ".json",
  );
}

async function ensureRoot() {
  await mkdir(rootDir, { recursive: true });
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function createImportJob(
  input: CreateImportJobInput,
): Promise<ImportJob> {
  validateImportDocuments(input);
  await ensureRoot();

  const now = new Date().toISOString();
  const id = "import-" + randomUUID();
  const totalPages = input.documents.reduce(
    (sum, document) => sum + Math.max(0, Number(document.pageCount) || 0),
    0,
  );

  const job: ImportJob = {
    format: IMPORT_JOB_FORMAT,
    version: IMPORT_JOB_VERSION,
    id,
    status: "uploading",
    createdAt: now,
    updatedAt: now,
    language: input.language,
    courseHint: input.courseHint,
    sourceManifest: input.sourceManifest,
    documents: input.documents,
    detectedMaps: input.detectedMaps,
    uploadedPages: 0,
    totalPages,
  };

  await mkdir(pagesDir(id), { recursive: true });
  await writeJsonAtomic(jobFile(id), job);
  return job;
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  try {
    return await readJson<ImportJob>(jobFile(jobId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function requireImportJob(jobId: string) {
  const job = await getImportJob(jobId);
  if (!job) throw new Error("Không tìm thấy import job: " + jobId);
  return job;
}

export async function updateImportJob(
  jobId: string,
  mutate: (job: ImportJob) => ImportJob,
) {
  const previous = jobWrites.get(jobId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = previous.then(() => gate);
  jobWrites.set(jobId, pending);
  await previous;
  try {
    const current = await requireImportJob(jobId);
    const next = mutate(current);
    next.updatedAt = new Date().toISOString();
    await writeJsonAtomic(jobFile(jobId), next);
    return next;
  } finally {
    release();
    if (jobWrites.get(jobId) === pending) jobWrites.delete(jobId);
  }
}

export async function appendImportPages(
  jobId: string,
  pages: ImportJobPage[],
) {
  const job = await requireImportJob(jobId);
  if (job.status !== "uploading") {
    throw new Error("Import job không còn nhận page upload.");
  }

  // Validate the entire batch before writing anything. Upload retries overwrite
  // only the same declared page key, so they cannot inflate the page count.
  for (const page of pages) validateImportPage(job, page);
  for (const page of pages) {
    await writeJsonAtomic(pageFile(jobId, page), page);
  }

  const stored = await readdir(pagesDir(jobId));
  const uploadedPages = stored.filter((name) => name.endsWith(".json")).length;

  return updateImportJob(jobId, (current) => ({
    ...current,
    uploadedPages,
  }));
}

export async function queueImportJob(jobId: string) {
  const current = await requireImportJob(jobId);

  if (current.status !== "uploading" && current.status !== "failed") {
    return current;
  }

  await assertAllSourcePages(current);

  const queued = await updateImportJob(jobId, (job) => {
    if (job.status !== "uploading" && job.status !== "failed") return job;
    return { ...job, status: "queued", error: undefined };
  });

  if (queued.status === "queued") await publishImportJobQueued(queued);
  return queued;
}

async function assertAllSourcePages(job: ImportJob) {
  validateImportDocuments(job);
  const missing: string[] = [];
  for (const document of job.documents) {
    for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber++) {
      const key = { documentId: document.documentId, pageNumber };
      try {
        const page = await readJson<ImportJobPage>(pageFile(job.id, key));
        validateImportPage(job, page);
        if (page.documentId !== key.documentId || page.pageNumber !== pageNumber) throw new Error("Snapshot key mismatch");
      } catch {
        missing.push(document.documentId + "/" + pageNumber);
      }
    }
  }
  if (missing.length) throw new Error("Thiếu hoặc hỏng page snapshot: " + missing.join(", "));
}

export async function listImportJobs(
  status?: ImportJobStatus,
): Promise<ImportJob[]> {
  await ensureRoot();
  const entries = await readdir(/* turbopackIgnore: true */ rootDir, { withFileTypes: true });
  const jobs: ImportJob[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const job = await getImportJob(entry.name);
    if (!job) continue;
    if (status && job.status !== status) continue;
    jobs.push(job);
  }

  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Read one declared physical page without scanning or sampling the book. */
export async function readImportPage(jobId: string, documentId: string, pageNumber: number) {
  const job = await requireImportJob(jobId);
  const document = job.documents.find(item => item.documentId === documentId);
  if (!document || !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > document.pageCount) {
    throw new RangeError("Trang không thuộc tài liệu nguồn đã khai báo.");
  }
  const page = await readJson<ImportJobPage>(pageFile(jobId, { documentId, pageNumber }));
  validateImportPage(job, page);
  if (page.documentId !== documentId || page.pageNumber !== pageNumber) throw new Error("Snapshot không khớp trang được yêu cầu.");
  return page;
}

export async function readImportPages(input: {
  jobId: string;
  fileName?: string;
  documentId?: string;
  startPage?: number;
  endPage?: number;
  limit?: number;
}) {
  const job = await requireImportJob(input.jobId);
  const selectedDocument = job.documents.find(
    (document) =>
      (input.documentId && document.documentId === input.documentId) ||
      (input.fileName && document.fileName === input.fileName),
  );

  if ((input.fileName || input.documentId) && !selectedDocument) {
    throw new Error("Không tìm thấy document trong import job.");
  }

  const pageNames = (await readdir(pagesDir(input.jobId)))
    .filter((name) => name.endsWith(".json"))
    .sort();

  const start = Math.max(1, input.startPage ?? 1);
  const end = Math.max(start, input.endPage ?? start + 7);
  const limit = Math.min(20, Math.max(1, input.limit ?? 8));
  const pages: ImportJobPage[] = [];

  for (const name of pageNames) {
    const page = await readJson<ImportJobPage>(
      path.join(pagesDir(input.jobId), name),
    );

    if (
      selectedDocument &&
      page.documentId !== selectedDocument.documentId
    ) {
      continue;
    }
    if (page.pageNumber < start || page.pageNumber > end) continue;

    pages.push(page);
    if (pages.length >= limit) break;
  }

  return pages;
}

export async function claimImportJob(jobId: string) {
  return updateImportJob(jobId, (job) => {
    if (job.status === "ready" || job.status === "consumed") return job;
    if (job.status !== "queued" && job.status !== "processing") {
      throw new Error("Import job chưa sẵn sàng để xử lý.");
    }
    return {
      ...job,
      status: "processing",
      error: undefined,
    };
  });
}
export async function deleteImportJob(jobId: string) {
  const job = await requireImportJob(jobId);

  if (!canDeleteImportJob(job.status)) {
    throw new Error(
      "Chỉ có thể xóa import job ở trạng thái failed hoặc consumed.",
    );
  }

  await rm(jobDir(jobId), {
    recursive: true,
    force: false,
  });

  return {
    id: job.id,
    status: job.status,
  };
}

export async function requeueImportJob(jobId: string, options?: { automatic?: boolean }) {
  const current = await requireImportJob(jobId);

  if (current.status === "ready" || current.status === "consumed") {
    throw new Error(
      "Không thể đưa job đã hoàn tất trở lại queued. Hãy tạo import job mới nếu muốn biên lại.",
    );
  }
  if (options?.automatic && (current.automaticRetries ?? 0) >= 3) {
    throw new Error("Đã thử lại tự động 3 lần. Cần kiểm tra lỗi nguồn hoặc compiler trước khi thử lại thủ công.");
  }

  await assertAllSourcePages(current);

  const queued = await updateImportJob(jobId, (job) => {
    if (job.status === "ready" || job.status === "consumed") throw new Error("Không thể đưa job đã khóa trở lại queued.");
    if (options?.automatic && (job.automaticRetries ?? 0) >= 3) throw new Error("Đã thử lại tự động 3 lần.");
    return { ...job, status: "queued", error: undefined, resultBundle: undefined,
      automaticRetries: options?.automatic ? (job.automaticRetries ?? 0) + 1 : 0 };
  });

  await publishImportJobQueued(queued);
  return queued;
}



type StoredLessonDraft = {
  version: 1;
  lessonId: number;
  savedAt: string;
  lesson: LessonContent;
  questions: StudyQuestion[];
};

export type WorkCheckpointPhase =
  | "source-reading"
  | "drafting"
  | "qa";

export type WorkCheckpoint = {
  version: 1;
  lessonId: number;
  phase: WorkCheckpointPhase;
  savedAt: string;
  sourceCursor?: {
    documentId?: string;
    fileName?: string;
    pageNumber?: number;
  };
  notes: string[];
  partialLesson?: Record<string, unknown>;
  partialQuestions?: Array<Record<string, unknown>>;
};

async function readLessonDrafts(jobId: string) {
  await mkdir(draftsDir(jobId), { recursive: true });
  const files = (await readdir(draftsDir(jobId)))
    .filter((name) => /^lesson-\d{5,}\.json$/.test(name))
    .sort();

  const drafts: StoredLessonDraft[] = [];
  const errors: Array<{ file: string; reason: string }> = [];
  for (const file of files) {
    try {
      const draft = await readJson<StoredLessonDraft>(path.join(draftsDir(jobId), file));
      if (!draft || draft.version !== 1 || draft.lessonId !== Number(file.match(/\d+/)?.[0]) || draft.lesson?.id !== draft.lessonId) throw new Error("Lesson draft identity mismatch");
      const job = await requireImportJob(jobId);
      normalizeDraft(job, draft.lesson, draft.questions);
      drafts.push(draft);
    } catch (error) {
      errors.push({ file, reason: error instanceof Error ? error.message : "Unreadable draft" });
    }
  }

  return { drafts, errors };
}

async function readWorkCheckpoints(jobId: string) {
  await mkdir(draftsDir(jobId), { recursive: true });
  const files = (await readdir(draftsDir(jobId)))
    .filter((name) => /^work-\d{5,}\.json$/.test(name))
    .sort();

  const checkpoints: WorkCheckpoint[] = [];
  const errors: Array<{ file: string; reason: string }> = [];
  for (const file of files) {
    try {
      const checkpoint = await readJson<WorkCheckpoint>(path.join(draftsDir(jobId), file));
      if (!checkpoint || checkpoint.version !== 1 || checkpoint.lessonId !== Number(file.match(/\d+/)?.[0]) ||
        !["source-reading", "drafting", "qa"].includes(checkpoint.phase) || !Array.isArray(checkpoint.notes)) throw new Error("Invalid work checkpoint");
      checkpoints.push(checkpoint);
    } catch (error) {
      errors.push({ file, reason: error instanceof Error ? error.message : "Unreadable checkpoint" });
    }
  }

  return { checkpoints, errors };
}

export async function saveWorkCheckpoint(
  jobId: string,
  input: {
    lessonId: number;
    phase: WorkCheckpointPhase;
    sourceCursor?: {
      documentId?: string;
      fileName?: string;
      pageNumber?: number;
    };
    notes?: string[];
    partialLesson?: Record<string, unknown>;
    partialQuestions?: Array<Record<string, unknown>>;
  },
) {
  const job = await requireImportJob(jobId);
  if (job.status === "ready" || job.status === "consumed") {
    throw new Error(
      "Job đã hoàn tất. Không thể ghi work checkpoint.",
    );
  }

  assertLessonId(input.lessonId);

  const checkpoint: WorkCheckpoint = {
    version: 1,
    lessonId: input.lessonId,
    phase: input.phase,
    savedAt: new Date().toISOString(),
    sourceCursor: input.sourceCursor
      ? {
          documentId: input.sourceCursor.documentId,
          fileName: input.sourceCursor.fileName,
          pageNumber:
            typeof input.sourceCursor.pageNumber === "number"
              ? input.sourceCursor.pageNumber
              : undefined,
        }
      : undefined,
    notes: (input.notes ?? []).map(String),
    partialLesson: input.partialLesson,
    partialQuestions: input.partialQuestions,
  };

  await writeJsonAtomic(
    workCheckpointFile(jobId, input.lessonId),
    checkpoint,
  );

  await updateImportJob(jobId, (current) => ({
    ...current,
    status:
      current.status === "queued" ? "processing" : current.status,
    error: undefined,
  }));

  return checkpoint;
}

async function clearWorkCheckpoint(jobId: string, lessonId: number) {
  try {
    await unlink(workCheckpointFile(jobId, lessonId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function normalizeDraft(
  job: ImportJob,
  lesson: LessonContent,
  questions: StudyQuestion[],
) {
  const parsed = parseCourseBundle(
    JSON.stringify({
      format: COURSE_BUNDLE_FORMAT,
      version: COURSE_BUNDLE_VERSION,
      language: job.language,
      sourceManifest: job.sourceManifest,
      course: {
        title: job.courseHint.title,
        level: job.courseHint.level,
        edition: job.courseHint.edition,
        lessons: [lesson],
        questions,
      },
    }),
  );

  const normalizedLesson = parsed.course.lessons[0];
  if (!normalizedLesson) {
    throw new Error("Lesson draft không hợp lệ.");
  }

  if (
    parsed.course.questions.some(
      (question) => question.lessonId !== normalizedLesson.id,
    )
  ) {
    throw new Error(
      "Mọi question trong lesson draft phải có lessonId trùng với lesson.",
    );
  }

  const questionIds = new Set<string>();
  for (const question of parsed.course.questions) {
    if (questionIds.has(question.id)) {
      throw new Error("Lesson draft có question id trùng: " + question.id);
    }
    questionIds.add(question.id);
  }

  return {
    lesson: normalizedLesson,
    questions: parsed.course.questions,
  };
}

export async function saveLessonDraft(
  jobId: string,
  lesson: LessonContent,
  questions: StudyQuestion[] = [],
) {
  const job = await requireImportJob(jobId);

  if (job.status === "ready" || job.status === "consumed") {
    throw new Error(
      "Job đã hoàn tất. Không thể ghi lesson draft vào course đã khóa.",
    );
  }

  const normalized = normalizeDraft(job, lesson, questions);
  const draft: StoredLessonDraft = {
    version: 1,
    lessonId: normalized.lesson.id,
    savedAt: new Date().toISOString(),
    lesson: normalized.lesson,
    questions: normalized.questions,
  };

  await writeJsonAtomic(
    lessonDraftFile(jobId, normalized.lesson.id),
    draft,
  );

  await clearWorkCheckpoint(jobId, normalized.lesson.id);

  await updateImportJob(jobId, (current) => ({
    ...current,
    status:
      current.status === "queued" ? "processing" : current.status,
    error: undefined,
  }));

  return draft;
}

export async function getCompilationProgress(jobId: string) {
  const job = await requireImportJob(jobId);
  const { drafts, errors: draftErrors } = await readLessonDrafts(jobId);
  const { checkpoints: workCheckpoints, errors: checkpointErrors } = await readWorkCheckpoints(jobId);
  const completedLessonIds = drafts
    .map((draft) => draft.lessonId)
    .sort((a, b) => a - b);
  const completed = new Set(completedLessonIds);

  const detectedCandidates = job.detectedMaps.flatMap((map) =>
    map.starts.map((start) => ({
      fileName: map.fileName,
      lessonId: start.lessonId,
      pageNumber: start.pageNumber,
      titleHint: start.titleHint,
    })),
  );

  const detectedLessonIds = Array.from(
    new Set(detectedCandidates.map((item) => item.lessonId)),
  ).sort((a, b) => a - b);

  const pendingDetectedLessonIds = detectedLessonIds.filter(
    (lessonId) => !completed.has(lessonId),
  );

  return {
    jobId: job.id,
    status: job.status,
    language: job.language,
    courseHint: job.courseHint,
    totalPages: job.totalPages,
    diagnostics: [...draftErrors, ...checkpointErrors],
    // A valid saved lesson is not proof of completeness against the textbook.
    // These are observed runtime counts; independent source totals stay unknown.
    sourceCoverage: job.curriculumCoverage?.sourceCoverage ?? null,
    validationCoverage: job.curriculumCoverage?.validationCoverage ?? null,
    curriculumCoverage: job.curriculumCoverage,
    completedLessonIds,
    completedLessons: drafts.map((draft) => ({
      lessonId: draft.lessonId,
      title: draft.lesson.title,
      learnerTitle: draft.lesson.vi,
      savedAt: draft.savedAt,
      questionCount: draft.questions.length,
      contentCounts: summarizeLessonPractice(draft.lesson, draft.questions),
      practiceCoverage: auditLessonPracticeCoverage(draft.lesson, draft.questions),
      coverageScore: draft.lesson.quality?.coverageScore,
      groundingScore: draft.lesson.quality?.groundingScore,
      issues: draft.lesson.quality?.issues ?? [],
    })),
    activeWork: workCheckpoints
      .filter((checkpoint) => !completed.has(checkpoint.lessonId))
      .map((checkpoint) => ({
        lessonId: checkpoint.lessonId,
        phase: checkpoint.phase,
        savedAt: checkpoint.savedAt,
        sourceCursor: checkpoint.sourceCursor,
        notes: checkpoint.notes,
        partialLesson: checkpoint.partialLesson,
        partialQuestions: checkpoint.partialQuestions,
      })),
    detectedCandidates,
    pendingDetectedLessonIds,
    nextDetectedLessonId: pendingDetectedLessonIds[0] ?? null,
    note:
      "Detected lesson candidates are hints, not ground truth. Ignore false positives and finalize only lessonIds verified from the textbook.",
  };
}

export async function finalizeCourseFromDrafts(
  jobId: string,
  input?: {
    lessonIds?: number[];
    title?: string;
    level?: string;
    edition?: string;
    sourceInventory?: unknown;
  },
) {
  const job = await requireImportJob(jobId);

  if (job.status === "ready" || job.status === "consumed") {
    if (job.resultBundle) return job;
    throw new Error("Job đã hoàn tất nhưng không còn result bundle.");
  }

  const { drafts, errors: draftErrors } = await readLessonDrafts(jobId);
  const { checkpoints, errors: checkpointErrors } = await readWorkCheckpoints(jobId);
  const errors = [...draftErrors, ...checkpointErrors];
  if (errors.length) throw new Error("Cần sửa checkpoint trước khi finalize: " + errors.map(item => item.file + ": " + item.reason).join("; "));
  if (!drafts.length) {
    throw new Error("Chưa có lesson draft nào để finalize.");
  }

  const byId = new Map(drafts.map((draft) => [draft.lessonId, draft]));
  const requestedIds = input?.lessonIds?.length
    ? Array.from(new Set(input.lessonIds))
    : drafts.map((draft) => draft.lessonId).sort((a, b) => a - b);

  const selected = requestedIds.map((lessonId) => {
    const draft = byId.get(lessonId);
    if (!draft) {
      throw new Error(
        "Thiếu lesson draft đã xác minh cho lessonId " + lessonId + ".",
      );
    }
    return draft;
  });
  const omittedIds = drafts.filter(draft => !requestedIds.includes(draft.lessonId)).map(draft => draft.lessonId);
  if (omittedIds.length) throw new Error("Không thể bỏ âm thầm lesson draft: " + omittedIds.join(", "));
  const unfinished = checkpoints.filter(checkpoint => !byId.has(checkpoint.lessonId));
  if (unfinished.length) throw new Error("Còn lesson checkpoint chưa hoàn tất: " + unfinished.map(item => item.lessonId).join(", "));

  const allQuestions = selected.flatMap((draft) => draft.questions);
  const globalQuestionIds = new Set<string>();
  for (const question of allQuestions) {
    if (globalQuestionIds.has(question.id)) {
      throw new Error(
        "Question id trùng giữa các lesson draft: " + question.id,
      );
    }
    globalQuestionIds.add(question.id);
  }

  const bundle = parseCourseBundle(
    JSON.stringify({
      format: COURSE_BUNDLE_FORMAT,
      version: COURSE_BUNDLE_VERSION,
      generatedAt: new Date().toISOString(),
      language: job.language,
      sourceFiles: job.documents.map((document) => document.fileName),
      sourceManifest: job.sourceManifest,
      sourceInventory: input?.sourceInventory === undefined ? undefined : sourceInventorySchema.parse(input.sourceInventory),
      course: {
        title: input?.title?.trim() || job.courseHint.title,
        level: input?.level?.trim() || job.courseHint.level,
        edition:
          input?.edition?.trim() || job.courseHint.edition || undefined,
        lessons: selected.map((draft) => draft.lesson),
        questions: allQuestions,
      },
    }),
  );

  return submitImportBundle(jobId, bundle);
}

export async function submitImportBundle(
  jobId: string,
  bundle: CompiledCourseBundle,
) {
  const current = await requireImportJob(jobId);
  const parsed = parseCourseBundle(JSON.stringify(bundle));
  parsed.language ??= current.language;
  if (current.status === "ready" || current.status === "consumed") {
    if (sameBundle(current.resultBundle, parsed)) return current;
    throw new Error("Job đã khóa; không thể ghi đè kết quả đã xuất bản.");
  }
  if (current.status !== "queued" && current.status !== "processing") throw new Error("Import job chưa sẵn sàng để nhận bundle.");
  if (!sameSourceManifest(current.sourceManifest, parsed.sourceManifest ?? [])) throw new Error("sourceManifest của bundle không khớp nguồn import.");
  if (parsed.language && (parsed.language.target !== current.language.target || parsed.language.learner !== current.language.learner)) {
    throw new Error("Language profile của bundle không khớp import job.");
  }
  await assertAllSourcePages(current);
  return updateImportJob(jobId, (job) => {
    // Recheck after all asynchronous validation and while holding the write
    // queue: another valid submission may have completed in the meantime.
    if (job.status === "ready" || job.status === "consumed") {
      if (sameBundle(job.resultBundle, parsed)) return job;
      throw new Error("Job đã khóa; không thể ghi đè kết quả đã xuất bản.");
    }
    if (job.status !== "queued" && job.status !== "processing") throw new Error("Import job chưa sẵn sàng để nhận bundle.");
    return {
    ...job,
    status: "ready",
    resultBundle: parsed,
    curriculumCoverage: auditCurriculumCoverage(parsed),
    error: undefined,
    };
  });
}

export async function failImportJob(jobId: string, error: string) {
  return updateImportJob(jobId, (job) => {
    if (job.status === "ready" || job.status === "consumed") throw new Error("Không thể đánh dấu failed cho job đã khóa.");
    return {
    ...job,
    status: "failed",
    error: error.slice(0, 4000),
    };
  });
}

export async function consumeImportJob(jobId: string) {
  return updateImportJob(jobId, (job) => ({
    ...job,
    status: job.status === "ready" ? "consumed" : job.status,
  }));
}
