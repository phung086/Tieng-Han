import { learningStateSchema } from "@/lib/db/learning-state-contract";
import { normalizeLessonProgress, refreshLearningDay, type LearningState } from "@/lib/learning-model";

export type ProgressCache = { state: LearningState; pending: boolean; revision: string | null };
export function progressStorageKey(courseId: string, userId?: string) {
  return `haneul-learning-state-v3:${userId ? "user:" + encodeURIComponent(userId) : "guest"}:${encodeURIComponent(courseId)}`;
}

export function parseProgressState(value: unknown): LearningState | null {
  const result = learningStateSchema.safeParse(value);
  return result.success ? refreshLearningDay(normalizeLessonProgress(result.data)) : null;
}

export function readProgressCache(storage: Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>, courseId: string, userId?: string): ProgressCache | null {
  try {
    const raw = storage.getItem(progressStorageKey(courseId, userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parseProgressState(parsed.state);
      if (state) return { state, pending: parsed.pending === true, revision: typeof parsed.revision === "string" ? parsed.revision : null };
    }
    if (userId) return null;
    const legacy = storage.getItem("haneul-learning-state-v2:" + courseId) ?? storage.getItem("haneul-learning-state-v2");
    if (!legacy) return null;
    const state = parseProgressState(JSON.parse(legacy));
    if (!state) return null;
    const cache = { state, pending: false, revision: null };
    storage.setItem(progressStorageKey(courseId), JSON.stringify(cache));
    storage.removeItem?.("haneul-learning-state-v2");
    return cache;
  } catch { return null; }
}

// A previous request must finish before a newer snapshot can overwrite it.
export class ProgressSaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  enqueue<T>(save: () => Promise<T>): Promise<T> {
    const next = this.tail.catch(() => undefined).then(save);
    this.tail = next;
    return next;
  }
}
