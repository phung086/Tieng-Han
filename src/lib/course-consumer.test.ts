import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unlink, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  activeCourseFilePath,
  courseLibraryDir,
  buildRuntimeCourseFromBundle,
  consumeReadyImportJob,
  getActiveCourse,
  getCourseLibrary,
} from "@/lib/course-consumer";
import { parseCourseBundle } from "@/lib/course-bundle";
import type { ImportJob } from "@/lib/import-jobs";
import {
  consumeImportJob,
  listImportJobs,
  readImportPages,
  requireImportJob,
} from "@/lib/import-job-store";

vi.mock("@/lib/import-job-store", () => ({
  requireImportJob: vi.fn(),
  consumeImportJob: vi.fn(),
  readImportPages: vi.fn(),
  listImportJobs: vi.fn(),
}));

function sampleBundle() {
  return parseCourseBundle(
    JSON.stringify({
      format: "haneul-course-bundle",
      version: 1,
      generatedAt: "2026-10-05T23:00:00Z",
      language: {
        target: "ko",
        learner: "vi",
        targetName: "Tiếng Hàn",
        learnerName: "Tiếng Việt",
        locale: "ko-KR",
        script: "hangul",
      },
      sourceFiles: ["book.pdf"],
      sourceManifest: [
        {
          name: "book.pdf",
          size: 100,
          lastModified: 1,
          pageCount: 10,
          sha256: "abc",
        },
      ],
      course: {
        title: "Tiếng Hàn Sơ cấp 1",
        level: "초급 1",
        lessons: [
          {
            id: 1,
            targetTitle: "소개",
            learnerTitle: "Giới thiệu",
            objective: "Chào hỏi và tự giới thiệu.",
            vocabulary: [
              {
                id: "v-1",
                targetText: "학생",
                learnerMeaning: "học sinh, sinh viên",
                example: "저는 학생입니다.",
              },
            ],
            grammar: [
              {
                id: "g-1",
                pattern: "N입니다",
                meaning: "là N",
                explanation: "Cấu trúc giới thiệu.",
                examples: ["저는 학생입니다."],
              },
            ],
            listening: [
              {
                id: "l-1",
                text: "안녕하세요?",
                meaning: "Xin chào?",
                choices: ["Xin chào?", "Tạm biệt."],
                answer: "Xin chào?",
              },
            ],
            speaking: ["안녕하세요. 저는 학생입니다."],
            reading: {
              title: "자기소개",
              text: "저는 학생입니다.",
              translation: "Tôi là học sinh.",
              questions: [],
            },
            writing: {
              prompt: "Viết câu tự giới thiệu.",
              hint: "Dùng N입니다.",
              targetWords: ["학생"],
            },
          },
        ],
        questions: [
          {
            id: "q-1",
            lessonId: 1,
            skill: "vocabulary",
            type: "choice",
            title: "Từ vựng",
            prompt: "학생 nghĩa là gì?",
            choices: ["học sinh, sinh viên", "giáo viên"],
            answer: "học sinh, sinh viên",
            explanation: "학생 = học sinh, sinh viên.",
          },
        ],
      },
    }),
  );
}

function readyJob(bundle: ReturnType<typeof sampleBundle>): ImportJob {
  return {
    format: "haneul-import-job",
    version: 1,
    id: "import-test-job",
    status: "ready",
    createdAt: "2026-10-05T23:00:00Z",
    updatedAt: "2026-10-05T23:00:00Z",
    language: bundle.language!,
    courseHint: {
      title: bundle.course.title,
      level: bundle.course.level,
    },
    sourceManifest: bundle.sourceManifest ?? [],
    documents: [
      {
        documentId: "doc-0",
        fileName: "book.pdf",
        pageCount: 10,
      },
    ],
    detectedMaps: [],
    uploadedPages: 10,
    totalPages: 10,
    resultBundle: bundle,
  } as unknown as ImportJob;
}

describe("course-consumer", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await unlink(activeCourseFilePath).catch(() => undefined);
    await rm(courseLibraryDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await unlink(activeCourseFilePath).catch(() => undefined);
    await rm(courseLibraryDir, { recursive: true, force: true });
  });

  it("consumes a ready import job into learner runtime course", async () => {
    const bundle = sampleBundle();
    const job = readyJob(bundle);
    const consumed = { ...job, status: "consumed" } as ImportJob;

    vi.mocked(requireImportJob).mockResolvedValue(job);
    vi.mocked(readImportPages).mockResolvedValue([]);
    vi.mocked(consumeImportJob).mockResolvedValue(consumed);

    const result = await consumeReadyImportJob(job.id);

    expect(result.job.status).toBe("consumed");
    expect(result.course.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(result.course.lessons).toHaveLength(1);
    expect(result.course.questions).toHaveLength(1);
    expect(consumeImportJob).toHaveBeenCalledWith(job.id);
  });

  it("returns the persisted active course after consume", async () => {
    const bundle = sampleBundle();
    const job = readyJob(bundle);
    const consumed = { ...job, status: "consumed" } as ImportJob;

    vi.mocked(requireImportJob).mockResolvedValue(job);
    vi.mocked(readImportPages).mockResolvedValue([]);
    vi.mocked(consumeImportJob).mockResolvedValue(consumed);
    vi.mocked(listImportJobs).mockResolvedValue([]);

    await consumeReadyImportJob(job.id);
    const active = await getActiveCourse();

    expect(active?.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(active?.lessons).toHaveLength(1);
  });


  it("rebuilds an already-consumed job when the persisted active course belongs to another job", async () => {
    const bundle = sampleBundle();
    const job = {
      ...readyJob(bundle),
      id: "import-new-job",
      status: "consumed",
    } as ImportJob;

    await mkdir(path.dirname(activeCourseFilePath), { recursive: true });
    await writeFile(
      activeCourseFilePath,
      JSON.stringify({
        ...buildRuntimeCourseFromBundle("import-old-job", bundle),
        title: "Old cached course",
      }),
      "utf8",
    );

    vi.mocked(requireImportJob).mockResolvedValue(job);
    vi.mocked(readImportPages).mockResolvedValue([]);

    const result = await consumeReadyImportJob(job.id);

    expect(result.course.id).toBe("course-import-new-job");
    expect(result.course.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(consumeImportJob).not.toHaveBeenCalled();
  });

  it("keeps multiple consumed course levels in the library", async () => {
    const levelOne = sampleBundle();
    const levelTwo = {
      ...sampleBundle(),
      course: {
        ...sampleBundle().course,
        title: "Tiếng Hàn Sơ cấp 2",
        level: "초급 2",
      },
    };

    const firstJob = {
      ...readyJob(levelOne),
      id: "import-level-1",
      status: "consumed",
      resultBundle: levelOne,
    } as ImportJob;
    const secondJob = {
      ...readyJob(levelTwo),
      id: "import-level-2",
      status: "consumed",
      resultBundle: levelTwo,
    } as ImportJob;

    vi.mocked(listImportJobs).mockResolvedValue([secondJob, firstJob]);
    vi.mocked(readImportPages).mockResolvedValue([]);

    const library = await getCourseLibrary();

    expect(library).toHaveLength(2);
    expect(library.map((item) => item.level).sort()).toEqual([
      "초급 1",
      "초급 2",
    ]);
    expect(library.map((item) => item.id)).toContain(
      "course-import-level-1",
    );
    expect(library.map((item) => item.id)).toContain(
      "course-import-level-2",
    );
  });

  it("uses language-neutral fallbacks for blank imported metadata", () => {
    const bundle = sampleBundle();
    const runtime = buildRuntimeCourseFromBundle("job-generic", {
      ...bundle,
      course: {
        ...bundle.course,
        title: "",
        level: "",
      },
    });

    expect(runtime.title).toBe("Tiếng Hàn");
    expect(runtime.level).toBe("General");
  });

  it("buildRuntimeCourseFromBundle formats course bundle correctly", () => {
    const runtime = buildRuntimeCourseFromBundle(
      "job-123",
      sampleBundle(),
      "data:image/jpeg;base64,mock",
    );

    expect(runtime.id).toBe("course-job-123");
    expect(runtime.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(runtime.level).toBe("초급 1");
    expect(runtime.source?.coverImageDataUrl).toBe(
      "data:image/jpeg;base64,mock",
    );
  });
});
