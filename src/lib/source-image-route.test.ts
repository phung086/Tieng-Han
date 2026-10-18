import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as image } from "@/app/api/courses/[courseId]/source-image/route";
import { GET as manifest } from "@/app/api/courses/[courseId]/lesson-book/route";
import { resolveCourseSource } from "./course-source-access";
import { readImportPage } from "./import-job-store";

vi.mock("./course-source-access", () => ({ resolveCourseSource: vi.fn(), sourceHeaders: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }));
vi.mock("./import-job-store", () => ({ readImportPage: vi.fn() }));
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const context = { params: Promise.resolve({ courseId: "course-source" }) };
const request = (query: string) => new Request("http://localhost/api/courses/course-source/source-image?" + query);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveCourseSource).mockResolvedValue({ course: { id: "course-source", lessons: [{ id: 1, sourceRef: "book.pdf pp.1-30", vocabulary: [], grammar: [], listening: [], speaking: [], reading: null, writing: null }] }, job: { id: "import-source", documents: [{ documentId: "doc-0", fileName: "book.pdf", pageCount: 40 }] } } as never);
  vi.mocked(readImportPage).mockResolvedValue({ fileName: "book.pdf", documentId: "doc-0", pageNumber: 30, text: "Original", hasVisual: true, previewImageDataUrl: "data:image/png;base64," + png, embeddedImages: [{ id: "figure-a", width: 1, height: 1, dataUrl: "data:image/png;base64," + png }] });
});
describe("private original image transport", () => {
  it("serves source bytes on late pages, with a private cache policy and correct MIME", async () => {
    const response = await image(request("page=30"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(png, "base64"));
    expect(readImportPage).toHaveBeenCalledWith("import-source", "doc-0", 30);
  });
  it("can address an exact embedded illustration without exposing another asset", async () => {
    expect((await image(request("page=30&image=figure-a"), context)).status).toBe(200);
    expect((await image(request("page=30&image=../private"), context)).status).toBe(404);
  });
  it("rejects invalid document/page requests before reading disk", async () => {
    for (const query of ["document=../private&page=1", "page=41", "page=0", "page=1.5"]) expect((await image(request(query), context)).status).toBe(400);
    expect(readImportPage).not.toHaveBeenCalled();
  });
  it("denies unauthorized source access for both the book manifest and image", async () => {
    vi.mocked(resolveCourseSource).mockResolvedValue({ error: "Không có quyền xem nguồn của khóa học này.", status: 403 });
    expect((await image(request("page=1"), context)).status).toBe(403);
    expect((await manifest(request("lesson=1"), context)).status).toBe(403);
    expect(readImportPage).not.toHaveBeenCalled();
  });
  it("does not serve executable, mislabeled or missing image data", async () => {
    for (const data of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,PGh0bWw+", undefined]) {
      vi.mocked(readImportPage).mockResolvedValue({ fileName: "book.pdf", documentId: "doc-0", pageNumber: 1, text: "", hasVisual: true, previewImageDataUrl: data });
      expect((await image(request("page=1"), context)).status).not.toBe(200);
    }
  });
  it("returns lightweight full-page metadata without embedding image bytes in the course", async () => {
    const response = await manifest(request("lesson=1"), context);
    const data = await response.json();
    expect(data.pages).toHaveLength(30);
    expect(JSON.stringify(data)).not.toContain("base64");
    expect(readImportPage).not.toHaveBeenCalled();
  });
});
