import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const oldRoot = process.env.HANEUL_IMPORT_DIR;
afterEach(() => {
  if (oldRoot === undefined) delete process.env.HANEUL_IMPORT_DIR;
  else process.env.HANEUL_IMPORT_DIR = oldRoot;
  vi.resetModules();
});

describe("import compilation work checkpoints preserve complete lessons", () => {
  it("round-trips 241 partial questions and 130 notes without truncating at 100", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "haneul-import-volume-"));
    try {
      process.env.HANEUL_IMPORT_DIR = root;
      vi.resetModules();
      const { saveWorkCheckpoint, getCompilationProgress } = await import("@/lib/import-job-store");
      const jobId = "import-volume-checkpoint-123";
      await mkdir(path.join(root, jobId), { recursive: true });
      const job = {
        format: "haneul-import-job",
        version: 1,
        id: jobId,
        status: "processing",
        createdAt: "2026-10-13T00:00:00.000Z",
        updatedAt: "2026-10-13T00:00:00.000Z",
        language: { target: "ko", learner: "vi", targetName: "Tiếng Hàn",
          learnerName: "Tiếng Việt", locale: "ko-KR", script: "hangul" },
        courseHint: { title: "Sơ cấp 1", level: "초급 1" },
        sourceManifest: [],
        documents: [],
        detectedMaps: [],
        uploadedPages: 0,
        totalPages: 0,
      };
      await writeFile(path.join(root, jobId, "job.json"), JSON.stringify(job));
      const partialQuestions = Array.from({ length: 241 }, (_, i) => ({
        id: "q-" + i, lessonId: 1, skill: "vocabulary", type: "input",
        prompt: "Nguồn trang " + (i + 1), answer: "단어" + i,
      }));
      const notes = Array.from({ length: 130 }, (_, i) => "Trang " + (i + 1) + " đã biên");
      await saveWorkCheckpoint(jobId, {
        lessonId: 1,
        phase: "drafting",
        sourceCursor: { fileName: "book.pdf", pageNumber: 380 },
        notes,
        partialQuestions,
        partialLesson: { vocabulary: Array.from({ length: 180 }, (_, i) => ({
          id: "v-" + i, targetText: "단어" + i, learnerMeaning: "nghĩa " + i,
        })) },
      });
      const progress = await getCompilationProgress(jobId);
      expect(progress.activeWork).toHaveLength(1);
      expect(progress.activeWork[0].partialQuestions).toHaveLength(241);
      expect(progress.activeWork[0].partialQuestions?.[240]).toEqual(partialQuestions[240]);
      expect(progress.activeWork[0].notes).toHaveLength(130);
      const vocab = progress.activeWork[0].partialLesson?.vocabulary;
      expect(Array.isArray(vocab) && vocab.length).toBe(180);

      const raw = JSON.parse(await readFile(path.join(
        root, jobId, "drafts", "work-00001.json",
      ), "utf8"));
      expect(raw.partialQuestions).toHaveLength(241);
      expect(raw.notes).toHaveLength(130);
      expect(raw.sourceCursor.pageNumber).toBe(380);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
