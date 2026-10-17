import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ImportJobPage } from "@/lib/import-jobs";
import { defaultLanguageProfile } from "@/lib/language-profile";
import { parseCourseBundle } from "@/lib/course-bundle";

vi.mock("@/lib/mcp-events", () => ({ publishImportJobQueued: vi.fn() }));
let root: string;
let store: typeof import("@/lib/import-job-store");
const oldRoot = process.env.HANEUL_IMPORT_DIR;
const manifest = [{ name: "synthetic.pdf", size: 100, lastModified: 1, pageCount: 2, sha256: "a".repeat(64) }];
const input = () => ({ language: defaultLanguageProfile, courseHint: { title: "Synthetic regression fixture", level: "L1" },
  sourceManifest: manifest, documents: [{ documentId: "doc-1", fileName: "synthetic.pdf", pageCount: 2 }], detectedMaps: [] });
const page = (pageNumber: number): ImportJobPage => ({ documentId: "doc-1", fileName: "synthetic.pdf", pageNumber, text: "학생 · test fixture", hasVisual: false });
const bundle = () => parseCourseBundle(JSON.stringify({ format: "haneul-course-bundle", version: 1,
  sourceManifest: manifest, course: { title: "Synthetic regression fixture", level: "L1", lessons: [{ id: 1,
    title: "학생", vi: "Học sinh", objective: "Fixture", vocabulary: [], grammar: [], listening: [], speaking: [], reading: null, writing: null }], questions: [] } }));

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "haneul-integrity-"));
  process.env.HANEUL_IMPORT_DIR = root;
  vi.resetModules();
  store = await import("@/lib/import-job-store");
});
afterEach(async () => {
  if (oldRoot === undefined) delete process.env.HANEUL_IMPORT_DIR;
  else process.env.HANEUL_IMPORT_DIR = oldRoot;
  // Only remove the explicit temporary fixture created by this test.
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("haneul-integrity-")) throw new Error("Unsafe fixture cleanup");
  await rm(resolved, { recursive: true, force: true });
  vi.resetModules();
});

describe("source import integrity and recovery", () => {
  it("reads exact declared pages and rejects missing, out-of-range or mismatched snapshots", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(2)]);
    expect((await store.readImportPage(job.id, "doc-1", 2)).text).toBe(page(2).text);
    await expect(store.readImportPage(job.id, "../private", 2)).rejects.toThrow();
    await expect(store.readImportPage(job.id, "doc-1", 3)).rejects.toThrow();
    await expect(store.readImportPage(job.id, "doc-1", 1)).rejects.toThrow();
    await writeFile(path.join(root, job.id, "pages", "doc-1-00002.json"), JSON.stringify(page(1)));
    await expect(store.readImportPage(job.id, "doc-1", 2)).rejects.toThrow("khớp");
  });
  it("validates document fingerprints and duplicate identities at job creation", async () => {
    await expect(store.createImportJob({ ...input(), documents: [{ ...input().documents[0], pageCount: 3 }] })).rejects.toThrow("khớp");
    await expect(store.createImportJob({ ...input(), sourceManifest: [...manifest, ...manifest], documents: [...input().documents, ...input().documents] })).rejects.toThrow();
  });

  it("rejects an entire invalid upload batch, preserves valid data and counts retries once", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1)]);
    await store.appendImportPages(job.id, [page(1)]);
    expect((await store.requireImportJob(job.id)).uploadedPages).toBe(1);
    await expect(store.appendImportPages(job.id, [page(2), page(3)])).rejects.toThrow("phạm vi");
    await expect(store.queueImportJob(job.id)).rejects.toThrow("doc-1/2");
    expect((await store.readImportPages({ jobId: job.id, startPage: 1, endPage: 2 }))).toHaveLength(1);
    await expect(store.appendImportPages(job.id, [{ ...page(2), documentId: "undeclared" }])).rejects.toThrow("khai báo");
    await store.appendImportPages(job.id, [page(2)]);
    expect((await store.queueImportJob(job.id)).status).toBe("queued");
  });

  it("does not trust uploadedPages metadata in place of every page snapshot", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1)]);
    await store.updateImportJob(job.id, current => ({ ...current, uploadedPages: 99 }));
    await expect(store.queueImportJob(job.id)).rejects.toThrow("doc-1/2");
    expect((await store.requireImportJob(job.id)).status).toBe("uploading");
  });

  it("validates and persists bundles at the store boundary, locks published results", async () => {
    const job = await store.createImportJob(input());
    await expect(store.submitImportBundle(job.id, bundle())).rejects.toThrow("sẵn sàng");
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await store.queueImportJob(job.id);
    const wrong = bundle();
    wrong.sourceManifest![0].sha256 = "b".repeat(64);
    await expect(store.submitImportBundle(job.id, wrong)).rejects.toThrow("sourceManifest");
    const invalid = bundle();
    invalid.course.lessons[0].grammar = [null as never];
    await expect(store.submitImportBundle(job.id, invalid)).rejects.toThrow("grammar");
    expect((await store.requireImportJob(job.id)).status).toBe("queued");
    const ready = await store.submitImportBundle(job.id, bundle());
    const persisted = JSON.parse(await readFile(path.join(root, job.id, "job.json"), "utf8"));
    expect(persisted.resultBundle).toEqual(ready.resultBundle);
    expect((await store.submitImportBundle(job.id, ready.resultBundle!)).status).toBe("ready");
    const changed = bundle(); changed.course.title = "Other";
    await expect(store.submitImportBundle(job.id, changed)).rejects.toThrow("đã khóa");
    expect((await store.requireImportJob(job.id)).resultBundle?.course.title).toBe(ready.resultBundle?.course.title);
    await expect(store.failImportJob(job.id, "late compiler error")).rejects.toThrow("đã khóa");
    expect((await store.requireImportJob(job.id)).status).toBe("ready");
  });

  it("preserves independent drafts after invalid lessons and refuses hidden exclusions", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await store.queueImportJob(job.id);
    const lesson = bundle().course.lessons[0];
    await store.saveLessonDraft(job.id, lesson);
    await expect(store.saveLessonDraft(job.id, { ...lesson, id: 2, vocabulary: [null as never] })).rejects.toThrow();
    await store.saveLessonDraft(job.id, { ...lesson, id: 3 });
    expect((await store.getCompilationProgress(job.id)).completedLessonIds).toEqual([1, 3]);
    await expect(store.finalizeCourseFromDrafts(job.id, { lessonIds: [1] })).rejects.toThrow("bỏ âm thầm");
    await store.saveWorkCheckpoint(job.id, { lessonId: 2, phase: "drafting", notes: ["unreadable source"] });
    await expect(store.finalizeCourseFromDrafts(job.id)).rejects.toThrow("chưa hoàn tất");
    await store.saveLessonDraft(job.id, { ...lesson, id: 2 });
    const ready = await store.finalizeCourseFromDrafts(job.id);
    expect(ready.resultBundle?.course.lessons.map(item => item.id)).toEqual([1, 2, 3]);
  });

  it("rejects corrupted snapshots even if total file count matches", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await writeFile(path.join(root, job.id, "pages", "doc-1-00002.json"), "{bad json");
    await expect(store.queueImportJob(job.id)).rejects.toThrow("doc-1/2");
  });

  it("isolates malformed drafts and checkpoints while independent lessons remain resumable", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await store.queueImportJob(job.id);
    const lesson = bundle().course.lessons[0];
    await store.saveLessonDraft(job.id, lesson);
    await store.saveWorkCheckpoint(job.id, { lessonId: 2, phase: "drafting" });
    await writeFile(path.join(root, job.id, "drafts", "lesson-00002.json"), "{broken");
    await writeFile(path.join(root, job.id, "drafts", "work-00003.json"), "null");
    const progress = await store.getCompilationProgress(job.id);
    expect(progress.completedLessonIds).toEqual([1]);
    expect(progress.activeWork.map(item => item.lessonId)).toEqual([2]);
    expect(progress.diagnostics.map(item => item.file)).toEqual(["lesson-00002.json", "work-00003.json"]);
    expect(progress.sourceCoverage).toBeNull();
    await store.saveLessonDraft(job.id, { ...lesson, id: 4 });
    expect((await store.getCompilationProgress(job.id)).completedLessonIds).toEqual([1, 4]);
    await expect(store.finalizeCourseFromDrafts(job.id)).rejects.toThrow("Cần sửa checkpoint");
    expect((await store.requireImportJob(job.id)).status).toBe("processing");
    expect(await readFile(path.join(root, job.id, "drafts", "lesson-00002.json"), "utf8")).toBe("{broken");
  });

  it("bounds automatic stale-job retries and retains checkpoints for manual recovery", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await store.queueImportJob(job.id);
    await store.saveLessonDraft(job.id, bundle().course.lessons[0]);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const queued = await store.requeueImportJob(job.id, { automatic: true });
      expect(queued.automaticRetries).toBe(attempt);
    }
    await expect(store.requeueImportJob(job.id, { automatic: true })).rejects.toThrow("3 lần");
    expect((await store.getCompilationProgress(job.id)).completedLessonIds).toEqual([1]);
    expect((await store.requeueImportJob(job.id)).automaticRetries).toBe(0);
  });

  it("serializes concurrent job updates without lost fields and recovers after a rejected mutation", async () => {
    const job = await store.createImportJob(input());
    await Promise.all(Array.from({ length: 20 }, () => store.updateImportJob(job.id, current => ({
      ...current, automaticRetries: (current.automaticRetries ?? 0) + 1,
    }))));
    expect((await store.requireImportJob(job.id)).automaticRetries).toBe(20);
    await expect(store.updateImportJob(job.id, () => { throw new Error("failed mutation"); })).rejects.toThrow("failed mutation");
    await store.updateImportJob(job.id, current => ({ ...current, automaticRetries: 21 }));
    expect((await store.requireImportJob(job.id)).automaticRetries).toBe(21);
  });

  it("allows only one different concurrent final result and idempotently accepts retries", async () => {
    const job = await store.createImportJob(input());
    await store.appendImportPages(job.id, [page(1), page(2)]);
    await store.queueImportJob(job.id);
    const first = bundle(); const second = bundle(); second.course.title = "A different result";
    const results = await Promise.allSettled([
      store.submitImportBundle(job.id, first), store.submitImportBundle(job.id, second),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const persisted = await store.requireImportJob(job.id);
    const winningInput = persisted.resultBundle?.course.title === first.course.title ? first : second;
    // The original input does not include the server's default language. It is
    // still an idempotent retry after canonicalization, even if key order differs.
    const retried = await store.submitImportBundle(job.id, { course: winningInput.course,
      version: winningInput.version, format: winningInput.format, sourceManifest: winningInput.sourceManifest });
    expect(retried.resultBundle).toEqual(persisted.resultBundle);
    expect((await store.requireImportJob(job.id)).resultBundle).toEqual(persisted.resultBundle);
  });
});
