import { describe, it, expect } from "vitest";
import {
  consumeReadyImportJob,
  getActiveCourse,
  buildRuntimeCourseFromBundle,
} from "@/lib/course-consumer";
import { getImportJob } from "@/lib/import-job-store";

describe("course-consumer", () => {
  const realJobId = "import-c56d3b5a-8fec-4e9d-b7ef-40e1b3071da5";

  it("consumes the real ready import job into learner runtime course", async () => {
    const result = await consumeReadyImportJob(realJobId);

    expect(result.job.id).toBe(realJobId);
    expect(result.job.status).toBe("consumed");

    expect(result.course.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(result.course.level).toBe("초급 1");
    expect(result.course.lessons).toHaveLength(15);
    expect(result.course.questions).toHaveLength(90);

    // Verify Lesson 1 and Hangeul foundation
    const lesson1 = result.course.lessons[0];
    expect(lesson1.id).toBe(1);
    expect(lesson1.title).toBe("소개");
    expect(lesson1.vi).toBe("Giới thiệu");
    expect(lesson1.vocabulary.length).toBeGreaterThan(0);
    expect(lesson1.grammar.length).toBeGreaterThan(0);
    expect(lesson1.extraSections?.[0].id).toBe("hangeul-foundation");

    // Verify job persisted on disk as consumed
    const jobOnDisk = await getImportJob(realJobId);
    expect(jobOnDisk?.status).toBe("consumed");
  });

  it("is idempotent when retrying consume on an already consumed job", async () => {
    const result = await consumeReadyImportJob(realJobId);
    expect(result.job.status).toBe("consumed");
    expect(result.course.lessons).toHaveLength(15);
    expect(result.course.questions).toHaveLength(90);
  });

  it("getActiveCourse returns the consumed course", async () => {
    const active = await getActiveCourse();
    expect(active).not.toBeNull();
    expect(active?.title).toBe("Tiếng Hàn Sơ cấp 1");
    expect(active?.lessons).toHaveLength(15);
    expect(active?.questions).toHaveLength(90);
  });

  it("buildRuntimeCourseFromBundle formats course bundle correctly", () => {
    const mockBundle = {
      format: "haneul-course-bundle" as const,
      version: 1 as const,
      sourceFiles: ["test.pdf"],
      sourceManifest: [
        {
          name: "test.pdf",
          size: 100,
          lastModified: Date.now(),
          pageCount: 10,
          sha256: "abc",
        },
      ],
      course: {
        title: "Test Course",
        level: "Beginner",
        lessons: [],
        questions: [],
      },
    };

    const runtime = buildRuntimeCourseFromBundle("job-123", mockBundle, "data:image/jpeg;base64,mock");
    expect(runtime.id).toBe("course-job-123");
    expect(runtime.title).toBe("Test Course");
    expect(runtime.level).toBe("Beginner");
    expect(runtime.source?.coverImageDataUrl).toBe("data:image/jpeg;base64,mock");
  });
});
