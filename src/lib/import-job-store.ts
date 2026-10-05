import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { publishImportJobQueued } from "@/lib/mcp-events";
import type { CompiledCourseBundle } from "@/lib/course-bundle";
import {
  IMPORT_JOB_FORMAT,
  IMPORT_JOB_VERSION,
  type CreateImportJobInput,
  type ImportJob,
  type ImportJobPage,
  type ImportJobStatus,
} from "@/lib/import-jobs";

const rootDir =
  process.env.HANEUL_IMPORT_DIR ||
  path.join(process.cwd(), ".haneul", "import-jobs");

function assertSafeId(jobId: string) {
  if (!/^[a-z0-9-]{8,80}$/i.test(jobId)) {
    throw new Error("Import job id không hợp lệ.");
  }
}

function jobDir(jobId: string) {
  assertSafeId(jobId);
  return path.join(rootDir, jobId);
}

function jobFile(jobId: string) {
  return path.join(jobDir(jobId), "job.json");
}

function pagesDir(jobId: string) {
  return path.join(jobDir(jobId), "pages");
}

function pageFile(jobId: string, page: Pick<ImportJobPage, "documentId" | "pageNumber">) {
  if (!/^[a-z0-9_-]{1,80}$/i.test(page.documentId)) {
    throw new Error("documentId không hợp lệ.");
  }
  const pageNumber = Number(page.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000) {
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

async function requireImportJob(jobId: string) {
  const job = await getImportJob(jobId);
  if (!job) throw new Error("Không tìm thấy import job: " + jobId);
  return job;
}

export async function updateImportJob(
  jobId: string,
  mutate: (job: ImportJob) => ImportJob,
) {
  const current = await requireImportJob(jobId);
  const next = mutate(current);
  next.updatedAt = new Date().toISOString();
  await writeJsonAtomic(jobFile(jobId), next);
  return next;
}

export async function appendImportPages(
  jobId: string,
  pages: ImportJobPage[],
) {
  const job = await requireImportJob(jobId);
  if (job.status !== "uploading") {
    throw new Error("Import job không còn nhận page upload.");
  }

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

  if (current.uploadedPages < current.totalPages) {
    throw new Error(
      "Chưa upload đủ page snapshot: " +
        current.uploadedPages +
        "/" +
        current.totalPages +
        ".",
    );
  }

  const queued = await updateImportJob(jobId, (job) => ({
    ...job,
    status: "queued",
    error: undefined,
  }));

  await publishImportJobQueued(queued);
  return queued;
}

export async function listImportJobs(
  status?: ImportJobStatus,
): Promise<ImportJob[]> {
  await ensureRoot();
  const entries = await readdir(rootDir, { withFileTypes: true });
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
export async function requeueImportJob(jobId: string) {
  const current = await requireImportJob(jobId);

  if (current.status === "ready" || current.status === "consumed") {
    throw new Error(
      "Không thể đưa job đã hoàn tất trở lại queued. Hãy tạo import job mới nếu muốn biên lại.",
    );
  }

  if (current.uploadedPages < current.totalPages) {
    throw new Error(
      "Chưa upload đủ page snapshot: " +
        current.uploadedPages +
        "/" +
        current.totalPages +
        ".",
    );
  }

  const queued = await updateImportJob(jobId, (job) => ({
    ...job,
    status: "queued",
    error: undefined,
    resultBundle: undefined,
  }));

  await publishImportJobQueued(queued);
  return queued;
}


export async function submitImportBundle(
  jobId: string,
  bundle: CompiledCourseBundle,
) {
  return updateImportJob(jobId, (job) => ({
    ...job,
    status: "ready",
    resultBundle: bundle,
    error: undefined,
  }));
}

export async function failImportJob(jobId: string, error: string) {
  return updateImportJob(jobId, (job) => ({
    ...job,
    status: "failed",
    error: error.slice(0, 4000),
  }));
}

export async function consumeImportJob(jobId: string) {
  return updateImportJob(jobId, (job) => ({
    ...job,
    status: job.status === "ready" ? "consumed" : job.status,
  }));
}
