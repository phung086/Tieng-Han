import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { WorksheetActivityStore } from "@/lib/worksheet-activity";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.join(tmpdir(), "haneul-activity-"))) throw new Error("Unexpected test path");
    await rm(root, { recursive: true, force: true });
  }
});
async function store() { const root = await mkdtemp(path.join(tmpdir(), "haneul-activity-")); roots.push(root); return new WorksheetActivityStore(root); }
it("keeps concurrent delivery/read/submit records, strips non-allowlisted values and isolates jobs", async () => {
  const activity = await store(), id = randomUUID();
  await Promise.all([
    activity.record(id, { kind: "dispatch_accepted", httpStatus: 200, attempt: 1, ...{ accessKey: "secret", callback: "private", question: "source" } }),
    activity.record(id, { kind: "read", page: 2 }),
    activity.record(id, { kind: "submitted", count: 6 }),
  ]);
  const entries = await activity.list(id);
  expect(entries.map((entry) => entry.kind)).toEqual(["dispatch_accepted", "read", "submitted"]);
  expect(JSON.stringify(entries)).not.toMatch(/secret|private|source|accessKey|callback|question/);
  expect(await activity.list(randomUUID())).toEqual([]);
  await activity.remove(id);
  expect(await activity.list(id)).toEqual([]);
});
it("bounds history and refuses traversal or invalid status without disrupting the worker", async () => {
  const activity = await store(), id = randomUUID();
  await Promise.all(Array.from({ length: 110 }, () => activity.record(id, { kind: "read", page: 1 })));
  expect(await activity.list(id)).toHaveLength(100);
  await activity.record(id, { kind: "dispatch_failed", httpStatus: 999 });
  expect(await activity.list(id)).toHaveLength(100);
  await expect(activity.record("../escape", { kind: "read" })).resolves.toBeUndefined();
});
