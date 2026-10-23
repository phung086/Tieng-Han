import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/admin/courses/[courseId]/status/route";
import {
  buildRuntimeCourseFromBundle,
  fingerprintRuntimeCourseEvidence,
  getCourseLibrary,
} from "@/lib/course-consumer";
import { setCourseStatus } from "@/lib/db/course-catalog";
import { parseCourseBundle } from "@/lib/course-bundle";

vi.mock("@/lib/auth/server", () => ({
  isSameOrigin: () => true,
  requireAdmin: async () => ({ id: "test-admin" }),
  recordAuditEvent: vi.fn(),
}));
vi.mock("@/lib/db/course-catalog", () => ({ setCourseStatus: vi.fn() }));
vi.mock("@/lib/course-consumer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/course-consumer")>();
  return { ...actual, getCourseLibrary: vi.fn() };
});

function completeBundle() {
  const sourceRef = "book.pdf · p.10 · v-1";
  return parseCourseBundle(JSON.stringify({
    format: "haneul-course-bundle",
    version: 1,
    sourceFiles: ["book.pdf"],
    sourceManifest: [{
      name: "book.pdf",
      size: 100,
      lastModified: 1,
      pageCount: 10,
      sha256: "a".repeat(64),
    }],
    sourceInventory: {
      version: 1,
      pages: Array.from({ length: 10 }, (_, index) => ({
        fileName: "book.pdf",
        pageNumber: index + 1,
        status: "reviewed",
        classification: index === 9 ? "learning-content" : "non-learning",
        ...(index === 9 ? {} : { reason: "Synthetic page independently reviewed as non-learning" }),
      })),
      items: [{
        id: "v-1",
        lessonId: 1,
        kind: "vocabulary",
        fileName: "book.pdf",
        pageNumber: 10,
        sourceRef,
        contentPointer: "/vocabulary/0",
        practiceMethod: "questions",
        practiceQuestionIds: ["q-1"],
        verified: true,
      }],
    },
    course: {
      title: "Synthetic Korean 1",
      level: "beginner-1",
      lessons: [{
        id: 1,
        title: "학생",
        vi: "Học sinh",
        objective: "Source evidence fixture",
        vocabulary: [{
          id: "v-1",
          ko: "학생",
          vi: "học sinh",
          example: "",
          sourceRef,
        }],
        grammar: [],
        listening: [],
        speaking: [],
        reading: null,
        writing: null,
      }],
      questions: [{
        id: "q-1",
        lessonId: 1,
        skill: "vocabulary",
        type: "input",
        title: "Từ vựng",
        prompt: "học sinh",
        answer: "학생",
        explanation: "Fixture",
        sourceRef,
        origin: "derived",
      }],
    },
  }));
}

const update = (courseId: string, status = "published") => PATCH(
  new Request("http://localhost/api/admin/courses/test/status", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  { params: Promise.resolve({ courseId }) },
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("publication re-audits persisted source evidence", () => {
  it("allows publication when current persisted content, inventory and fingerprint reconcile", async () => {
    const candidate = buildRuntimeCourseFromBundle("gate-job", completeBundle());
    vi.mocked(getCourseLibrary).mockResolvedValue([candidate] as never);
    vi.mocked(setCourseStatus).mockResolvedValue({
      course_id: candidate.id,
      status: "published",
    } as never);

    const response = await update(candidate.id);

    expect(response.status).toBe(200);
    expect(setCourseStatus).toHaveBeenCalledWith(candidate.id, "published");
  });

  it("rejects changed question content when its stored source fingerprint is stale", async () => {
    const original = buildRuntimeCourseFromBundle("gate-stale-job", completeBundle());
    const changed = {
      ...original,
      questions: original.questions.map(question => ({
        ...question,
        prompt: question.prompt + " edited",
      })),
    };
    vi.mocked(getCourseLibrary).mockResolvedValue([changed] as never);

    expect((await update(changed.id)).status).toBe(409);
    expect(setCourseStatus).not.toHaveBeenCalled();
  });

  it("rejects a changed page inventory even if the fingerprint is recomputed", async () => {
    const original = buildRuntimeCourseFromBundle("gate-inventory-job", completeBundle());
    const changed = {
      ...original,
      source: {
        ...original.source,
        sourceInventory: {
          ...original.source!.sourceInventory!,
          pages: original.source!.sourceInventory!.pages.slice(1),
        },
      },
    };
    if (changed.source) {
      changed.source.evidenceFingerprint = fingerprintRuntimeCourseEvidence(changed);
    }
    vi.mocked(getCourseLibrary).mockResolvedValue([changed] as never);

    expect((await update(changed.id)).status).toBe(409);
    expect(setCourseStatus).not.toHaveBeenCalled();
  });

  it("fails closed for legacy courses without retained source inventory", async () => {
    const original = buildRuntimeCourseFromBundle("gate-legacy-job", completeBundle());
    const legacy = {
      ...original,
      source: {
        ...original.source,
        sourceInventory: undefined,
        evidenceFingerprint: undefined,
      },
    };
    vi.mocked(getCourseLibrary).mockResolvedValue([legacy] as never);

    expect((await update(legacy.id)).status).toBe(409);
    expect(setCourseStatus).not.toHaveBeenCalled();
  });

  it("still allows saving a draft without asserting source completeness", async () => {
    vi.mocked(setCourseStatus).mockResolvedValue({
      course_id: "legacy",
      status: "draft",
    } as never);

    expect((await update("legacy", "draft")).status).toBe(200);
    expect(getCourseLibrary).not.toHaveBeenCalled();
  });
});
