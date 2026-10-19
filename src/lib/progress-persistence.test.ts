import { describe, expect, it } from "vitest";
import { createLearningState } from "@/lib/learning-model";
import { progressStorageKey, ProgressSaveQueue, readProgressCache } from "@/lib/progress-persistence";
import { saveLearningStateSchema } from "@/lib/db/learning-state-contract";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
describe("account and course persistence", () => {
  it("isolates guest, learner A, learner B, and separate course caches", () => {
    const store = storage();
    store.setItem(progressStorageKey("book", "A"), JSON.stringify({ state: { ...createLearningState(), xp: 80 }, pending: true, revision: null }));
    expect(readProgressCache(store, "book", "A")?.state.xp).toBe(80);
    expect(readProgressCache(store, "book", "B")).toBeNull();
    expect(readProgressCache(store, "book")).toBeNull();
    expect(readProgressCache(store, "other-book", "A")).toBeNull();
  });
  it("migrates legacy progress only into the guest cache and only one course", () => {
    const store = storage();
    store.setItem("haneul-learning-state-v2", JSON.stringify({ ...createLearningState(), xp: 40 }));
    expect(readProgressCache(store, "book", "A")).toBeNull();
    expect(readProgressCache(store, "book")?.state.xp).toBe(40);
    expect(readProgressCache(store, "other-book")).toBeNull();
  });
  it("keeps a pending snapshot and its exact server revision", () => {
    const store = storage();
    const revision = "2026-10-06T12:00:00.123456Z";
    store.setItem(progressStorageKey("book", "A"), JSON.stringify({ state: createLearningState(), pending: true, revision }));
    expect(readProgressCache(store, "book", "A")).toMatchObject({ pending: true, revision });
  });
  it("rejects invalid statistics and malformed dates", () => {
    const state = createLearningState();
    state.skills.grammar = { correct: 2, total: 1 };
    expect(saveLearningStateSchema.safeParse({ courseId: "book", state }).success).toBe(false);
    state.skills.grammar = { correct: 1, total: 1 };
    state.mastery.q1 = { strength: 50, lastReviewed: "nonsense", dueAt: "2026-99-99" };
    expect(saveLearningStateSchema.safeParse({ courseId: "book", state }).success).toBe(false);
  });
  it("accepts PostgreSQL revisions with microseconds", () => {
    expect(saveLearningStateSchema.safeParse({ courseId: "book", state: createLearningState(), expectedUserId: "A", expectedUpdatedAt: "2026-10-06T12:00:00.123456Z" }).success).toBe(true);
  });
  it("rejects corrupt browser storage without propagating it to the account", () => {
    const store = storage(); store.setItem(progressStorageKey("book", "A"), "{broken");
    expect(readProgressCache(store, "book", "A")).toBeNull();
  });
  it("serializes snapshots even when an earlier request rejects", async () => {
    const queue = new ProgressSaveQueue(); const events: string[] = [];
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const first = queue.enqueue(async () => { events.push("first start"); await gate; events.push("first end"); throw new Error("offline"); });
    const second = queue.enqueue(async () => { events.push("second"); });
    await Promise.resolve(); await Promise.resolve();
    expect(events).toEqual(["first start"]);
    finish(); await expect(first).rejects.toThrow("offline"); await second;
    expect(events).toEqual(["first start", "first end", "second"]);
  });
});
