import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const mocks = vi.hoisted(() => ({ user: vi.fn(), configured: vi.fn(), jobs: vi.fn(), progress: vi.fn(), receipts: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/db", () => ({ isDatabaseConfigured: mocks.configured }));
vi.mock("@/lib/import-job-store", () => ({ listImportJobs: mocks.jobs, getCompilationProgress: mocks.progress }));
vi.mock("@/lib/import-monitor-log", () => ({ readMcpReceipts: mocks.receipts }));
import { GET } from "./route";

let directory: string;
beforeEach(async () => {
  vi.resetAllMocks();
  directory = await mkdtemp(path.join(os.tmpdir(), "haneul-monitor-api-"));
  vi.stubEnv("HANEUL_EVENT_DIR", directory);
  mocks.configured.mockReturnValue(true);
  mocks.user.mockResolvedValue({ id: "admin", role: "admin" });
  mocks.jobs.mockResolvedValue([]); mocks.receipts.mockResolvedValue([]);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
describe("admin import monitoring boundary", () => {
  it("rejects anonymous and learner requests before reading source/job files", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/import-monitor"))).status).toBe(401);
    mocks.user.mockResolvedValue({ role: "learner" });
    expect((await GET(new Request("http://localhost/api/import-monitor"))).status).toBe(403);
    expect(mocks.jobs).not.toHaveBeenCalled();
  });
  it("returns no-store connection status without callback or bearer credentials", async () => {
    vi.stubEnv("HANEUL_MCP_TOKEN", "private-bearer");
    vi.stubEnv("HANEUL_MCP_PUBLIC_URL", "https://haneul.example/anything?token=private");
    await writeFile(path.join(directory, "subscriptions.json"), JSON.stringify({ subscriptions: [
      { name: "import_job.queued", arguments: {}, url: "https://private-callback", secret: "private-secret", refreshBefore: new Date(Date.now() + 100_000).toISOString() },
      { name: "import_job.queued", arguments: {}, refreshBefore: "2000-01-01" },
    ] }));
    const response = await GET(new Request("http://localhost/api/import-monitor"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result = await response.json();
    expect(result.connection).toMatchObject({ endpoint: "https://haneul.example/mcp", auth: "bearer", subscriptions: 1, matchingSubscriptions: 1 });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("rejects invalid or deleted job IDs and reports read failures explicitly", async () => {
    expect((await GET(new Request("http://localhost/api/import-monitor?jobId=../secret"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/import-monitor?jobId=import-missing1234"))).status).toBe(404);
    mocks.jobs.mockRejectedValue(new Error("private path"));
    const response = await GET(new Request("http://localhost/api/import-monitor"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private path");
  });
  it("reports real drafts/checkpoints without exposing partial content or treating candidates as final totals", async () => {
    const id = "import-job-test1234";
    mocks.jobs.mockResolvedValue([{ id, status: "processing", createdAt: "2026-10-06T05:00:00Z", updatedAt: "2026-10-06T06:00:00Z", courseHint: { title: "Test" }, language: { target: "ko" }, documents: [{ fileName: "test.pdf" }], uploadedPages: 44, totalPages: 44 }]);
    mocks.progress.mockResolvedValue({ status: "processing", completedLessons: [{ lessonId: 1, learnerTitle: "Bài 1", savedAt: "2026-10-06T06:00:00Z", questionCount: 6, issues: [] }], activeWork: [{ lessonId: 2, phase: "qa", savedAt: "2026-10-06T06:00:00Z", sourceCursor: { fileName: "test.pdf", pageNumber: 12 }, notes: ["Đang kiểm tra"], partialQuestions: [{ secretSource: "private" }], partialLesson: { secretSource: "private" } }], detectedCandidates: [{ lessonId: 1 }, { lessonId: 1 }, { lessonId: 2 }] });
    await writeFile(path.join(directory, "subscriptions.json"), JSON.stringify({ subscriptions: [{ name: "import_job.queued", arguments: { targetLanguage: "en" }, refreshBefore: new Date(Date.now() + 100_000).toISOString() }] }));
    const data = await (await GET(new Request("http://localhost/api/import-monitor?jobId=" + id))).json();
    expect(data.job).toMatchObject({ uploadedPages: 44, totalPages: 44, candidateCount: 2, bundleLessons: null });
    expect(data.job.work[0]).toMatchObject({ phase: "qa", pageNumber: 12, partialQuestions: 1 });
    expect(data.connection).toMatchObject({ subscriptions: 1, matchingSubscriptions: 0 });
    expect(JSON.stringify(data)).not.toContain("private");
  });
});
