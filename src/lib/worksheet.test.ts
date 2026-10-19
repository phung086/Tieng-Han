import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { questionsFromText, SAMPLE_WORKSHEET, worksheetRequestSchema } from "@/lib/worksheet-contract";
import { layoutNotebook, ROWS, seededRandom, wrapNotebookText } from "@/lib/worksheet-layout";
import { WorksheetJobStore } from "@/lib/worksheet-jobs";
import { readWorksheetBody } from "@/lib/worksheet-http";

const directories: string[] = [];
afterEach(async () => { vi.useRealTimers(); for (const directory of directories.splice(0)) { if (!directory.startsWith(path.join(tmpdir(), "haneul-worksheet-"))) throw new Error("Unexpected test path"); await rm(directory, { recursive: true, force: true }); } });
async function store() { const root = await mkdtemp(path.join(tmpdir(), "haneul-worksheet-")); directories.push(root); return new WorksheetJobStore(root); }
const question = { id: "q1", page: 1, question: "Hoa là người Việt Nam.", instruction: "Dịch Việt Hàn", warning: "" };
const solved = { ...question, answer: "호아 씨는 베트남 사람입니다.", translation: "" };

describe("worksheet parsing and limits", () => {
  it("removes known decoration, keeps source and direction", () => {
    expect(questionsFromText("Bài 1: giới thiệu\n1. Dịch câu Việt Hàn\n1. Hoa là người Việt Nam.\n........\n2. Bạn của tôi là bác sĩ.").map((item) => [item.question, item.instruction])).toEqual([[question.question, "1. Dịch câu Việt Hàn"], ["Bạn của tôi là bác sĩ.", "1. Dịch câu Việt Hàn"]]);
  });
  it("normalizes decomposed Vietnamese and does not discard ordinary sentences", () => { expect(questionsFromText("Cô giáo đang giới thiệu bài 1.".normalize("NFD"))[0].question).toBe("Cô giáo đang giới thiệu bài 1."); });
  it("rejects URLs, unsupported image types, duplicate IDs and excess pages", () => {
    for (const image of ["https://example.org/photo.jpg", "data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64,!"]) expect(worksheetRequestSchema.safeParse({ action: "extract", pages: [{ page: 1, image }] }).success).toBe(false);
    expect(worksheetRequestSchema.safeParse({ action: "solve", questions: [question, question] }).success).toBe(false);
    expect(worksheetRequestSchema.safeParse({ action: "extract", pages: Array.from({ length: 7 }, (_, i) => ({ page: i + 1, text: "hi" })) }).success).toBe(false);
  });
  it("bounds actual request bytes without Content-Length", async () => {
    const request = new Request("http://localhost/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "a".repeat(200) }) });
    await expect(readWorksheetBody(request, 100)).rejects.toMatchObject({ status: 413 });
  });
});

describe("notebook layout", () => {
  const measure = (text: string) => Array.from(text).length * 35;
  it("wraps long Korean without spaces and preserves all graphemes", () => {
    const source = "한국어선생님입니다".repeat(20);
    const lines = wrapNotebookText(source, 200, measure);
    expect(lines.join("")).toBe(source);
    expect(lines.every((line) => measure(line) <= 200)).toBe(true);
  });
  it("preserves Vietnamese accents and explicit dialogue line breaks", () => {
    expect(wrapNotebookText("A: 안녕하세요?\nB: 반갑습니다.", 2000, measure)).toEqual(["A: 안녕하세요?", "B: 반갑습니다."]);
    expect(wrapNotebookText("Tiếng Việt".normalize("NFD"), 2000, measure)).toEqual(["Tiếng Việt"]);
  });
  it("paginates all text without crossing the page bottom", () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ ...solved, id: `q${i}`, question: question.question.repeat(5), translation: "Đây là bản dịch.".repeat(5) }));
    const pages = layoutNotebook(items, measure);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().every((line) => line.row >= 0 && line.row < ROWS)).toBe(true);
    for (let i = 0; i < items.length; i++) {
      const lines = pages.flat().filter((line) => line.item === i);
      expect(lines.filter((line) => line.role === "question").map((line) => line.text).join("").replaceAll(" ", "")).toBe(`${i + 1}. ${items[i].question}`.replaceAll(" ", ""));
      expect(lines.filter((line) => line.role === "answer").map((line) => line.text).join("").replaceAll(" ", "")).toBe((items[i].answer + items[i].translation).replaceAll(" ", ""));
    }
  });
  it("keeps a fitting question/answer pair together when the page is nearly full", () => {
    const pages = layoutNotebook(Array.from({ length: 18 }, (_, i) => ({ ...solved, id: `${i}` })), () => 10);
    for (let i = 0; i < 18; i++) expect(pages.filter((p) => p.some((line) => line.item === i))).toHaveLength(1);
  });
  it("never outputs metadata/heading and reuses deterministic pen variation", () => {
    const pages = layoutNotebook(SAMPLE_WORKSHEET, measure);
    expect(pages.flat().some((line) => line.text.includes("Phiên âm"))).toBe(false);
    const a = seededRandom(604), b = seededRandom(604);
    expect(Array.from({ length: 20 }, () => a())).toEqual(Array.from({ length: 20 }, () => b()));
  });
});

describe("separate ChatGPT worksheet store", () => {
  it("isolates owners and per-job capabilities; validates digest and immutable source", async () => {
    const jobs = await store();
    const job = await jobs.create("alice", { action: "solve", questions: [question] });
    await expect(jobs.owned(job.id, "bob")).rejects.toThrow();
    await expect(jobs.read(job.id, "incorrect")).rejects.toThrow();
    await expect(jobs.read("../../secret", job.accessKey)).rejects.toThrow();
    expect((await jobs.read(job.id, job.accessKey)).digest).toBe(job.digest);
    await expect(jobs.submit(job.id, job.accessKey, "wrong", { version: 1, items: [solved] })).rejects.toThrow();
    await expect(jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [{ ...solved, question: "changed" }] })).rejects.toThrow();
    expect(await jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [solved] })).toMatchObject({ status: "ready", count: 1 });
    expect(await jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [solved] })).toMatchObject({ status: "ready" });
    await expect(jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [{ ...solved, answer: "different" }] })).rejects.toThrow();
    await jobs.remove(job.id, "alice");
    await expect(jobs.read(job.id, job.accessKey)).rejects.toThrow();
  });
  it("returns image only on explicit page read; rejects nonexistent source pages", async () => {
    const jobs = await store();
    const job = await jobs.create("alice", { action: "extract", pages: [{ page: 1, text: "source", image: "data:image/png;base64,AAAA" }] });
    const metadata = await jobs.read(job.id, job.accessKey);
    expect(JSON.stringify(metadata)).not.toContain("base64");
    expect(JSON.stringify(await jobs.read(job.id, job.accessKey, 1))).toContain("base64");
    await expect(jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [{ ...solved, page: 2 }] })).rejects.toThrow();
  });
  it("requires warning for unresolved answers; expires and revokes access", async () => {
    const jobs = await store();
    const job = await jobs.create("alice", { action: "solve", questions: [question] });
    await expect(jobs.submit(job.id, job.accessKey, job.digest, { version: 1, items: [{ ...solved, answer: "" }] })).rejects.toThrow();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 25 * 3600_000);
    await expect(jobs.read(job.id, job.accessKey)).rejects.toThrow("hết hạn");
  });
});
