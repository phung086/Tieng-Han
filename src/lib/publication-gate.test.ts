import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/admin/courses/[courseId]/status/route";
import { getCourseLibrary } from "@/lib/course-consumer";
import { setCourseStatus } from "@/lib/db/course-catalog";

vi.mock("@/lib/auth/server", () => ({ isSameOrigin: () => true, requireAdmin: async () => ({ id: "test-admin" }), recordAuditEvent: vi.fn() }));
vi.mock("@/lib/course-consumer", () => ({ getCourseLibrary: vi.fn() }));
vi.mock("@/lib/db/course-catalog", () => ({ setCourseStatus: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
const update = (status: string) => PATCH(new Request("http://localhost/api/admin/courses/test/status", { method: "PATCH", body: JSON.stringify({ status }) }), { params: Promise.resolve({ courseId: "test" }) });

describe("admin publication release gate", () => {
  it.each([undefined, "unverified", "partial", "blocked", "complete"])("refuses publication with legacy %s source evidence without changing catalog state", async status => {
    vi.mocked(getCourseLibrary).mockResolvedValue([{ id: "test", source: status ? { curriculumCoverage: { status } } : {} }] as never);
    const response = await update("published");
    expect(response.status).toBe(409);
    expect(setCourseStatus).not.toHaveBeenCalled();
  });
  it("allows a fully reconciled inventory to reach the database publication guard", async () => {
    vi.mocked(getCourseLibrary).mockResolvedValue([{ id: "test", source: { curriculumCoverage: { auditVersion: 2, status: "complete" } } }] as never);
    vi.mocked(setCourseStatus).mockResolvedValue({ course_id: "test", status: "published" } as never);
    expect((await update("published")).status).toBe(200);
    expect(setCourseStatus).toHaveBeenCalledWith("test", "published");
  });
  it("permits saving a draft without asserting coverage", async () => {
    vi.mocked(setCourseStatus).mockResolvedValue({ course_id: "test", status: "draft" } as never);
    expect((await update("draft")).status).toBe(200);
    expect(getCourseLibrary).not.toHaveBeenCalled();
  });
});
