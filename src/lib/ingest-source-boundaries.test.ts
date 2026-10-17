import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as validate } from "@/app/api/ingest/validate/route";
import { POST as generate } from "@/app/api/ingest/generate/route";
import { callContentModel, callVisionContentModel } from "@/lib/content-ai";
vi.mock("@/lib/auth/api-guard", () => ({ requireAdminApiAccess: async () => null }));
vi.mock("@/lib/content-ai", () => ({ callContentModel: vi.fn(), callVisionContentModel: vi.fn() }));
const page = (index: number, text = "source instruction", image = false) => ({ fileName: "synthetic.pdf", pageNumber: index, text, ...(image ? { imageDataUrl: "data:image/png;base64,AA==" } : {}) });
const send = (handler: typeof validate, body: unknown) => handler(new Request("http://localhost/api/ingest", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); });
describe("ingest routes never silently sample sources or diagnostics", () => {
  it("rejects a validation request whose final source would previously disappear", async () => {
    const response = await send(validate, { lesson: { id: 1 }, pages: [page(1, "a".repeat(74_000)), page(2, "final unit".repeat(500))] });
    expect(response.status).toBe(413);
    expect(callContentModel).not.toHaveBeenCalled();
  });
  it.each([generate, validate])("rejects excess visual pages without calling a model on only the first eight", async handler => {
    const response = await send(handler, { lessonId: 1, lesson: { id: 1 }, pages: Array.from({ length: 9 }, (_, index) => page(index + 1, "", true)) });
    expect(response.status).toBe(413);
    expect(callVisionContentModel).not.toHaveBeenCalled();
  });
  it("keeps every QA issue and refuses perfect self-scores when an original unit is missing", async () => {
    const missing = Array.from({ length: 45 }, (_, index) => "missing original unit " + index);
    vi.mocked(callContentModel).mockResolvedValue({ pass: true, coverageScore: 100, groundingScore: 100, issues: [], missingTopics: missing });
    const response = await send(validate, { lesson: { id: 1 }, pages: [page(1)] });
    const result = await response.json();
    expect(result.pass).toBe(false);
    expect(result.missingTopics).toEqual(missing);
  });
});
