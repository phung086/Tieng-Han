import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/courses/[courseId]/source/route";
import { getCourseLibrary } from "@/lib/course-consumer";
import { getImportJob, readImportPage } from "@/lib/import-job-store";
import { getCourseAccess } from "@/lib/db/course-access";
import { isDatabaseConfigured } from "@/lib/db";
vi.mock("@/lib/course-consumer", () => ({ getCourseLibrary: vi.fn() }));
vi.mock("@/lib/import-job-store", () => ({ getImportJob: vi.fn(), readImportPage: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/db", () => ({ isDatabaseConfigured: vi.fn(() => false) }));
vi.mock("@/lib/db/course-access", () => ({ getCourseAccess: vi.fn() }));
const id = "course-import-synthetic-1234";
const request = (query = "") => GET(new Request("http://localhost/api/courses/" + id + "/source" + query), { params: Promise.resolve({ courseId: id }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDatabaseConfigured).mockReturnValue(false);
  vi.mocked(getCourseLibrary).mockResolvedValue([{ id, source: { fileNames: ["synthetic.pdf"] } }] as never);
  vi.mocked(getImportJob).mockResolvedValue({ id: "import-synthetic-1234", documents: [{ documentId: "doc-0", fileName: "synthetic.pdf", pageCount: 300 }] } as never);
});
describe("complete original source access", () => {
  it("reads the final physical page without limiting access to the first batch", async () => {
    vi.mocked(readImportPage).mockResolvedValue({ documentId: "doc-0", fileName: "synthetic.pdf", pageNumber: 300, text: "final original exercise", hasVisual: false });
    const response = await request("?page=300");
    expect(response.status).toBe(200);
    expect((await response.json()).page.text).toBe("final original exercise");
    expect(readImportPage).toHaveBeenCalledWith("import-synthetic-1234", "doc-0", 300);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("keeps missing pages explicit instead of silently navigating over them", async () => {
    vi.mocked(readImportPage).mockRejectedValue(new Error("corrupt snapshot"));
    const body = await (await request("?page=200")).json();
    expect(body.page).toBeNull(); expect(body.pageNumber).toBe(200);
    expect(body.documents[0].pageCount).toBe(300);
    expect(body.error).toContain("không được tính");
  });
  it("rejects undeclared documents, invalid page numbers and cross-course sources", async () => {
    expect((await request("?document=../secret&page=1")).status).toBe(400);
    expect((await request("?page=301")).status).toBe(400);
    vi.mocked(getCourseLibrary).mockResolvedValue([{ id, source: { fileNames: ["another.pdf"] } }] as never);
    expect((await request()).status).toBe(404);
    expect(readImportPage).not.toHaveBeenCalled();
  });
  it("checks publication access before reading any private snapshots", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(true);
    vi.mocked(getCourseAccess).mockResolvedValue({ exists: true, allowed: false, status: "draft" });
    expect((await request()).status).toBe(403);
    expect(getCourseLibrary).not.toHaveBeenCalled();
    expect(readImportPage).not.toHaveBeenCalled();
  });
});
