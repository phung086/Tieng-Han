import { test, expect, type APIRequestContext } from "@playwright/test";

async function tool(request: APIRequestContext, name: string, args: Record<string, unknown>) {
  const response = await request.post("/mcp", {
    headers: { Authorization: "Bearer " + process.env.HANEUL_E2E_MCP_TOKEN, Accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.ok()).toBe(true);
  const body = await response.text();
  const event = body.startsWith("{") ? JSON.parse(body) : JSON.parse(body.split("\n").find(line => line.startsWith("data: "))!.slice(6));
  expect(event.error).toBeUndefined();
  expect(event.result.isError).not.toBe(true);
  return JSON.parse(event.result.content.find((item: { type: string }) => item.type === "text").text);
}

test("real HTTP import, checkpoint, publish, reload and practice work without an AI provider key", async ({ request, page }) => {
  const sourceManifest = [{ name: "synthetic-source.pdf", size: 100, lastModified: 1, pageCount: 2, sha256: "a".repeat(64) }];
  const create = await request.post("/api/import-jobs", { data: { sourceManifest,
    documents: [{ documentId: "doc-0", fileName: "synthetic-source.pdf", pageCount: 2 }],
    courseHint: { title: "Synthetic HTTP import regression", level: "test" }, detectedMaps: [],
  } });
  expect(create.status()).toBe(201);
  const { job } = await create.json();
  const uploaded = await request.put(`/api/import-jobs/${job.id}/pages`, { data: { pages: [1, 2].map(pageNumber => ({
    documentId: "doc-0", fileName: "synthetic-source.pdf", pageNumber,
    text: "학생 — học sinh", hasVisual: false,
  })) } });
  expect(uploaded.ok()).toBe(true);
  const queued = await request.patch(`/api/import-jobs/${job.id}`, { data: { action: "queue" } });
  expect((await queued.json()).job.status).toBe("queued");
  await tool(request, "prepare_import_job", { jobId: job.id });
  const source = await tool(request, "get_compilation_contract", { jobId: job.id });
  expect(source.runtimeSchema.LessonContent).toBeTruthy();
  const lesson = { id: 1, title: "학생", vi: "Học sinh", objective: "Synthetic fixture only",
    vocabulary: [{ id: "v1", ko: "학생", vi: "học sinh", example: "학생", sourceRef: "synthetic-source.pdf · p.1 · v1" }],
    grammar: [], listening: [], speaking: [], reading: null, writing: null, sourceRef: "synthetic-source.pdf · pp.1-2" };
  const questions = [{ id: "q1", lessonId: 1, skill: "vocabulary", type: "input", title: "Từ nguồn", prompt: "học sinh", answer: "학생", explanation: "Synthetic source fixture", sourceRef: "synthetic-source.pdf · p.1 · v1" }];
  await tool(request, "save_lesson_draft", { jobId: job.id, lesson, questions });
  const progress = await tool(request, "get_compilation_progress", { jobId: job.id });
  expect(progress.completedLessonIds).toEqual([1]);
  expect(progress.sourceCoverage).toBeNull();
  await tool(request, "finalize_course_bundle", { jobId: job.id, sourceInventory: {
    version: 1, pages: [1, 2].map(pageNumber => ({ fileName: "synthetic-source.pdf", pageNumber, status: "reviewed" })),
    items: [{ id: "v1", lessonId: 1, kind: "vocabulary", fileName: "synthetic-source.pdf", pageNumber: 1,
      sourceRef: "synthetic-source.pdf · p.1 · v1", contentPointer: "/vocabulary/0", practiceMethod: "questions", practiceQuestionIds: ["q1"], verified: true }],
  } });
  const consume = await request.patch(`/api/import-jobs/${job.id}`, { data: { action: "consume" } });
  expect(consume.ok()).toBe(true);
  const consumed = await consume.json();
  expect(consumed.job.status).toBe("consumed");
  expect(consumed.course.source.curriculumCoverage.status).toBe("complete");
  const library = await (await request.get("/api/courses")).json();
  expect(library.courses.some((course: { id: string }) => course.id === "course-" + job.id)).toBe(true);
  await page.goto("/learn/1");
  await expect(page.getByRole("heading", { name: "학생", exact: true })).toBeVisible();
  await page.getByText("Nội dung đã nhập · Đã đối chiếu inventory", { exact: false }).click();
  await expect(page.getByText("Kết quả dưới đây đối chiếu với inventory", { exact: false })).toBeVisible();
  await page.goto("/practice/drills?lesson=1&mode=dictation");
  await expect(page.locator('input[type="text"], textarea').first()).toBeVisible();
});
