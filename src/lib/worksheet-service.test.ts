import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ text: vi.fn(), vision: vi.fn() }));
vi.mock("@/lib/content-ai", () => ({ callContentModel: mocks.text, callVisionContentModel: mocks.vision }));
import { processWorksheet } from "@/lib/worksheet-service";
const question = { id: "q1", page: 1, question: "저(은, 는) 학생입니다.", instruction: "Chọn tiểu từ đúng.", warning: "" };
beforeEach(() => { vi.resetAllMocks(); });
describe("worksheet model boundary", () => {
  it("keeps exact edited question and context; attaches solution by ID", async () => {
    mocks.text.mockResolvedValue({ answers: [{ id: "q1", answer: "저는 학생입니다.", translation: "Tôi là học sinh.", warning: "" }] });
    expect(await processWorksheet({ action: "solve", questions: [question] })).toEqual([{ ...question, answer: "저는 학생입니다.", translation: "Tôi là học sinh." }]);
    expect(mocks.text.mock.calls[0][1]).toContain(question.question);
  });
  it("rejects omitted or unexpected answers instead of silently mapping them", async () => {
    for (const answers of [[], [{ id: "wrong", answer: "wrong", translation: "", warning: "" }], [{ id: "q1", answer: "a", translation: "", warning: "" }, { id: "q1", answer: "b", translation: "", warning: "" }]]) {
      mocks.text.mockResolvedValue({ answers });
      await expect(processWorksheet({ action: "solve", questions: [question] })).rejects.toThrow();
    }
  });
  it("keeps OCR as extraction, rejects invented source pages", async () => {
    mocks.vision.mockResolvedValue({ questions: [question] });
    expect(await processWorksheet({ action: "extract", pages: [{ page: 1, text: "source" }] })).toEqual([{ ...question, answer: "", translation: "" }]);
    mocks.vision.mockResolvedValue({ questions: [{ ...question, page: 2 }] });
    await expect(processWorksheet({ action: "extract", pages: [{ page: 1, text: "source" }] })).rejects.toThrow();
  });
});
