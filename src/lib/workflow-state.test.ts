import { describe, expect, it } from "vitest";
import { importWorkflow, worksheetWorkflow, type WorksheetEvidence } from "@/lib/workflow-state";
import type { ImportMonitorSnapshot } from "@/lib/import-monitor";

const now = Date.now();
const evidence: WorksheetEvidence = { createdAt: now - 600_000, checkedAt: now, sourcePages: [1, 2], activity: [{ kind: "dispatch_accepted", at: now - 300_000, httpStatus: 200, attempt: 1 }] };
describe("observable worksheet stages", () => {
  it("does not treat delivery as execution or an existing preview as a solved job", () => {
    const state = worksheetWorkflow(evidence, false, false, false);
    expect(state.tone).toBe("warning");
    expect(state.steps.map(step => step.state)).toEqual(["done", "done", "current", "waiting", "waiting"]);
    expect(state.note).toContain("hạn mức Work");
    expect(worksheetWorkflow(evidence, false, true, false).steps[4].state).toBe("waiting");
  });
  it("keeps duplicate page reads distinct and rejects a premature downloadable-file claim", () => {
    const current = { ...evidence, activity: [...evidence.activity, { kind: "read" as const, at: now, page: 1 }, { kind: "read" as const, at: now, page: 1 }] };
    expect(worksheetWorkflow(current, false, false, false).steps[2].detail).toBe("1/2 trang ảnh đã gọi đọc");
    expect(worksheetWorkflow(current, false, false, false).steps[2].state).toBe("current");
    const full = { ...current, activity: [...current.activity, { kind: "read" as const, at: now, page: 2 }] };
    expect(worksheetWorkflow(full, false, false, false).steps[2].state).toBe("done");
    expect(worksheetWorkflow(current, true, false, true).steps[4].state).toBe("current");
    expect(worksheetWorkflow(current, true, true, false).tone).toBe("success");
  });
  it("distinguishes rejected results, disconnected monitoring and callback failure", () => {
    const rejected = { ...evidence, activity: [...evidence.activity, { kind: "read" as const, at: now - 1000 }, { kind: "result_rejected" as const, at: now }] };
    expect(worksheetWorkflow(rejected, false, false, false).title).toBe("Dừng ở bước nhận đáp án");
    expect(worksheetWorkflow(rejected, false, false, false).steps[3].state).toBe("blocked");
    expect(worksheetWorkflow(evidence, false, false, false, "Mạng lỗi").note).toContain("Chưa thể kết luận");
    const failed = { ...evidence, activity: [{ kind: "dispatch_failed" as const, at: now, httpStatus: 502, attempt: 3 }] };
    expect(worksheetWorkflow(failed, false, false, false).steps[1].state).toBe("blocked");
  });
});

function snapshot(): ImportMonitorSnapshot {
  return { checkedAt: new Date(now).toISOString(), connection: { endpoint: "/mcp", eventName: "import_job.queued", protocol: "2026-07-28", auth: "development", subscriptions: 1, matchingSubscriptions: 1, nextRefreshBefore: null, error: null }, configuration: { automatic: true, autoRequeueMinutes: 20, recording: true }, jobs: [], receipts: [], recordingError: null,
    job: { id: "job-1", title: "Nguồn", status: "queued", createdAt: new Date(now - 600_000).toISOString(), updatedAt: new Date(now - 600_000).toISOString(), uploadedPages: 10, totalPages: 10, files: ["source.pdf"], error: null, completed: [], work: [], candidateCount: 15, bundleLessons: null } };
}
it("keeps compiler waiting stages separate and does not infer completion from candidate counts", () => {
  const state = importWorkflow(snapshot())!;
  expect(state.tone).toBe("warning");
  expect(state.steps.map(step => step.state)).toEqual(["done", "current", "waiting", "waiting"]);
  expect(state.note).not.toContain("75%");
});
it("provider tool contact does not hide missing persisted compiler progress", () => {
  const data = snapshot(); data.job!.status = "processing";
  data.receipts = [{ id: "receipt", at: new Date(now).toISOString(), method: "tools/call", tool: "get_compilation_progress", jobId: "job-1", body: "parsed" }];
  const state = importWorkflow(data)!;
  expect(state.tone).toBe("warning");
  expect(state.lastActivity).toBe(now);
  expect(state.steps[1].state).toBe("current");
  data.job!.status = "consumed";
  expect(importWorkflow(data)!.steps.every(step => step.state === "done")).toBe(true);
});
