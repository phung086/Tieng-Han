import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describeMcpReceipt, readMcpReceipts, recordMcpRequest } from "@/lib/import-monitor-log";
import { importAlert, type ImportMonitorSnapshot } from "@/lib/import-monitor";
import type { ImportJobStatus } from "@/lib/import-jobs";

const jobId = "import-12345678-abcd-1234-5678-123456789abc";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "haneul-monitor-"));
  vi.stubEnv("HANEUL_IMPORT_MONITOR_DIR", directory);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

describe("passive MCP receipts", () => {
  it("retains allowlisted metadata and drops source text, callback secrets and RPC IDs", () => {
    const result = describeMcpReceipt({ id: "private-id", method: "tools/call", params: { name: "save_work_checkpoint", arguments: { jobId, lessonId: 2, phase: "qa", sourceCursor: { pageNumber: 23 }, notes: ["secret"], token: "secret", partialLesson: { source: "secret" } } } }, new Date().toISOString());
    expect(result).toMatchObject({ jobId, lessonId: 2, phase: "qa", startPage: 23, body: "parsed" });
    expect(JSON.stringify(result)).not.toMatch(/secret|private-id|partialLesson/);
    expect(JSON.stringify(describeMcpReceipt({ method: "events/subscribe", params: { subscription: { url: "https://private", secret: "secret" } } }, "now"))).not.toMatch(/secret|private/);
  });
  it("records before handling without consuming the original request body", async () => {
    const body = { method: "tools/call", params: { name: "read_import_pages", arguments: { jobId, startPage: 4, endPage: 8 } } };
    const request = new Request("http://localhost/mcp", { method: "POST", body: JSON.stringify(body) });
    await recordMcpRequest(request);
    expect(await request.json()).toEqual(body);
    expect(await readMcpReceipts(jobId)).toEqual([expect.objectContaining({ jobId, tool: "read_import_pages", startPage: 4, endPage: 8 })]);
  });
  it("keeps concurrent original request bodies readable alongside passive observations", async () => {
    await Promise.all(Array.from({ length: 24 }, async (_, index) => {
      const body = { method: "tools/call", params: { name: "read_import_pages", arguments: { jobId, startPage: index + 1 } } };
      const request = new Request("http://localhost/mcp", { method: "POST", body: JSON.stringify(body) });
      const observation = recordMcpRequest(request);
      expect(await request.json()).toEqual(body);
      await observation;
    }));
  });
  it("keeps originals usable after observations finish and request clones are garbage collected", async () => {
    const { setFlagsFromString } = await import("node:v8");
    const { runInNewContext } = await import("node:vm");
    setFlagsFromString("--expose_gc");
    const collect = runInNewContext("gc") as () => void;
    setFlagsFromString("--no-expose_gc");
    const body = { method: "tools/call", params: { name: "read_import_pages", arguments: { jobId, startPage: 1 } } };
    const request = new Request("http://localhost/mcp", { method: "POST", body: JSON.stringify(body) });
    await recordMcpRequest(request);
    for (let index = 0; index < 3; index++) {
      collect();
      await new Promise(resolve => setImmediate(resolve));
    }
    expect(request.bodyUsed).toBe(false);
    expect(await request.json()).toEqual(body);
  });
  it("keeps invalid and oversized JSON usable and marks metadata omitted", async () => {
    for (const body of ["not JSON", "x".repeat(1_048_577)]) {
      const request = new Request("http://localhost/mcp", { method: "POST", body });
      await recordMcpRequest(request);
      expect(await request.text()).toBe(body);
    }
    expect((await readMcpReceipts()).map(r => r.body)).toEqual(["omitted", "omitted"]);
  });
  it("filters other jobs, preserves connection calls and tolerates a partial final line", async () => {
    await writeFile(path.join(directory, "requests.jsonl"), [
      { id: "one", at: "2026-10-06T08:00:00Z", method: "tools/call", jobId },
      { id: "two", at: "2026-10-06T08:01:00Z", method: "tools/call", jobId: "import-other-job-12345" },
      { id: "three", at: "2026-10-06T08:02:00Z", method: "events/subscribe" },
    ].map(r => JSON.stringify(r)).join("\n") + '\n{"id":');
    expect((await readMcpReceipts(jobId)).map(r => r.id)).toEqual(["three", "one"]);
  });
});

describe("truthful stalled-job warnings", () => {
  function snapshot(status: ImportJobStatus, matches = 1): ImportMonitorSnapshot {
    return {
      checkedAt: "2026-10-06T08:00:00Z",
      connection: { endpoint: "/mcp", eventName: "import_job.queued", protocol: "2026-07-28", auth: "development", subscriptions: 1, matchingSubscriptions: matches, nextRefreshBefore: null, error: null },
      configuration: { automatic: true, autoRequeueMinutes: 20, recording: true }, jobs: [], receipts: [], recordingError: null,
      job: { id: jobId, title: "Test", status, createdAt: "2026-10-06T06:00:00Z", updatedAt: "2026-10-06T07:00:00Z", uploadedPages: 44, totalPages: 44, files: [], work: [], completed: [], error: null, candidateCount: 0, bundleLessons: null },
    };
  }
  it("does not equate a subscription or recent read request with actual compilation", () => {
    const result = snapshot("queued");
    result.receipts = [{ id: "read", at: result.checkedAt, jobId, method: "tools/call", tool: "get_import_job", body: "parsed" }];
    expect(importAlert(result, 5)).toContain("hiện chưa được nhận");
  });
  it("checks language-matching subscriptions and respects recent saved checkpoints", () => {
    expect(importAlert(snapshot("queued", 0), 5)).toContain("khớp ngôn ngữ");
    const result = snapshot("processing");
    result.job!.work = [{ lessonId: 1, phase: "qa", savedAt: "2026-10-06T07:59:00Z", notes: [], partialQuestions: 0 }];
    expect(importAlert(result, 5)).toBeNull();
    expect(importAlert(snapshot("processing"), 5)).toContain("chưa xác nhận");
  });
  it("does not warn about finished jobs or turn an error into a time estimate", () => {
    expect(importAlert(snapshot("ready", 0), 5)).toBeNull();
    expect(importAlert(snapshot("consumed", 0), 5)).toBeNull();
    const failed = snapshot("failed"); failed.job!.error = "Nguồn bị hỏng";
    expect(importAlert(failed, 5)).toBe("Nguồn bị hỏng");
  });
});
