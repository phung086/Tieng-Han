"use client";
import { clientFetch } from "@/lib/client-request";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useContent } from "@/lib/content-store";
import { useAuth } from "@/lib/auth-client";
import {
  activateLearningDay, completeLearningActivity, completeLearningMastery, completeLearningSkill,
  createLearningState, localDateKey, recordLearningAnswer, refreshLearningDay, shiftedDateKey,
  type LearningState, type SkillKey, type SkillStat,
} from "@/lib/learning-model";
import { parseProgressState, progressStorageKey, ProgressSaveQueue, readProgressCache } from "@/lib/progress-persistence";

export type { SkillKey, LearningState } from "@/lib/learning-model";
export type SyncStatus = "loading" | "local" | "saved" | "pending" | "offline" | "conflict";
type SyncSession = {
  scope: string; courseId: string; userId?: string; run: number;
  revision: string | null; saved: string; latest: LearningState; allowed: boolean;
};
type LearningContextValue = {
  state: LearningState; hydrated: boolean; syncStatus: SyncStatus; canImportGuest: boolean;
  retrySync: () => void; importGuestProgress: () => void;
  resolveConflict: (useLocal: boolean) => Promise<void>;
  recordAnswer: (skill: SkillKey, correct: boolean, activityId?: string) => void;
  addXp: (amount: number) => void;
  setLessonProgress: (lessonId: number, progress: number) => void;
  completeActivity: (activityId: string, xp?: number) => void;
  completeLessonSkill: (lessonId: number, skill: SkillKey) => void;
  completeLessonMastery: (lessonId: number) => void;
  resetProgress: () => void; resetForCourse: (courseId?: string) => void;
};

const defaultState = createLearningState();
const LearningContext = createContext<LearningContextValue | null>(null);

function readBrowserProgress(courseId: string, userId?: string) {
  try { return readProgressCache(window.localStorage, courseId, userId); }
  catch { return null; }
}

function cacheSession(session: SyncSession) {
  try {
    window.localStorage.setItem(session.scope, JSON.stringify({
      state: session.latest, pending: Boolean(session.userId && JSON.stringify(session.latest) !== session.saved), revision: session.revision,
    }));
  } catch { /* Account sync remains available without browser storage. */ }
}

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const { activeCourseId, hydrated: contentHydrated } = useContent();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const scope = progressStorageKey(activeCourseId, userId);
  const [snapshot, setSnapshot] = useState({ scope: "", generation: 0, state: defaultState });
  const [sync, setSync] = useState<{ scope: string; status: SyncStatus }>({ scope: "", status: "loading" });
  const [canImportGuest, setCanImportGuest] = useState(false);
  const [reload, setReload] = useState(0);
  const runRef = useRef(0);
  const sessionRef = useRef<SyncSession | null>(null);
  const saveQueue = useRef(new ProgressSaveQueue());
  const hydrated = !authLoading && contentHydrated && snapshot.scope === scope && snapshot.generation === reload;
  const state = hydrated ? snapshot.state : defaultState;
  const syncStatus = hydrated && sync.scope === scope ? sync.status : "loading";

  const saveSession = useCallback(async (session: SyncSession) => {
    if (!session.allowed || !session.userId) return;
    const serialized = JSON.stringify(session.latest);
    if (serialized === session.saved) return;
    const requestState = session.latest;
    await saveQueue.current.enqueue(async () => {
      if (!session.allowed || serialized === session.saved) return;
      try {
        const response = await clientFetch("/api/me/learning-state", {
          method: "PUT", headers: { "content-type": "application/json" },
          body: JSON.stringify({ courseId: session.courseId, state: requestState, expectedUserId: session.userId, expectedUpdatedAt: session.revision }),
          keepalive: serialized.length < 45_000,
        });
        if (!response.ok) {
          session.allowed = false;
          if (runRef.current === session.run) setSync({ scope: session.scope, status: response.status === 409 ? "conflict" : "offline" });
          return;
        }
        const data = await response.json() as { revision: string };
        session.revision = data.revision;
        session.saved = serialized;
        if (sessionRef.current === session || sessionRef.current?.scope !== session.scope) cacheSession(session);
        if (runRef.current === session.run) setSync({ scope: session.scope, status: JSON.stringify(session.latest) === session.saved ? "saved" : "pending" });
      } catch {
        session.allowed = false;
        if (runRef.current === session.run) setSync({ scope: session.scope, status: "offline" });
      }
    });
  }, []);

  useEffect(() => {
    if (!contentHydrated || authLoading || activeCourseId === "empty") return;
    const run = ++runRef.current;
    const controller = new AbortController();
    const cached = readBrowserProgress(activeCourseId, userId);
    const guest = userId ? readBrowserProgress(activeCourseId) : null;
    const session: SyncSession = { scope, courseId: activeCourseId, userId, run, revision: cached?.revision ?? null, saved: cached?.pending ? "" : JSON.stringify(cached?.state ?? defaultState), latest: cached?.state ?? createLearningState(), allowed: false };
    sessionRef.current = session;

    async function hydrate() {
      let status: SyncStatus = userId ? "offline" : "local";
      let hasServerState = false;
      if (userId) {
        try {
          const response = await clientFetch("/api/me/learning-state?courseId=" + encodeURIComponent(activeCourseId), { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("Unable to load progress");
          const data = await response.json() as { state: unknown; revision: string | null };
          const serverState = data.state === null ? createLearningState() : parseProgressState(data.state);
          if (!serverState) throw new Error("Invalid stored progress");
          hasServerState = data.state !== null;
          session.saved = JSON.stringify(serverState);
          session.revision = data.revision;
          session.latest = cached?.pending ? cached.state : serverState;
          const conflict = cached?.pending && cached.revision !== data.revision;
          session.allowed = !conflict;
          status = conflict ? "conflict" : cached?.pending ? "pending" : "saved";
        } catch {
          if (controller.signal.aborted) return;
          // Never upload an empty fallback when the server could not be read.
          session.allowed = false;
        }
      }
      if (runRef.current !== run) return;
      setCanImportGuest(Boolean(userId && !hasServerState && !cached?.state.xp && guest?.state.xp && status !== "offline"));
      setSnapshot({ scope, generation: reload, state: session.latest });
      setSync({ scope, status });
    }
    void hydrate();
    return () => {
      controller.abort();
      if (runRef.current === run) runRef.current += 1;
      cacheSession(session);
      // expectedUserId prevents an old request from writing to a new account.
      void saveSession(session);
    };
  }, [activeCourseId, contentHydrated, authLoading, userId, scope, reload, saveSession]);

  useEffect(() => {
    if (!hydrated) return;
    const session = sessionRef.current;
    if (!session || session.scope !== scope) return;
    session.latest = state;
    cacheSession(session);
    if (!session.userId || !session.allowed || JSON.stringify(state) === session.saved) return;
    const timer = window.setTimeout(() => void saveSession(session), 650);
    return () => window.clearTimeout(timer);
  }, [hydrated, state, scope, saveSession]);

  useEffect(() => {
    function flush() {
      const session = sessionRef.current;
      if (session) { cacheSession(session); void saveSession(session); }
    }
    function resume() {
      if (document.visibilityState !== "visible") { flush(); return; }
      setSnapshot(current => ({ ...current, state: refreshLearningDay(current.state) }));
    }
    function online() { setReload(value => value + 1); }
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(resume, 60_000);
    return () => {
      window.removeEventListener("pagehide", flush); window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", resume); window.clearInterval(timer);
    };
  }, [saveSession]);

  const update = useCallback((change: (current: LearningState) => LearningState) => {
    if (!hydrated) return;
    setSnapshot(current => current.scope === scope ? { ...current, state: change(current.state) } : current);
    if (userId && syncStatus !== "offline" && syncStatus !== "conflict") setSync({ scope, status: "pending" });
  }, [hydrated, scope, userId, syncStatus]);

  const value = useMemo<LearningContextValue>(() => ({
    state, hydrated, syncStatus, canImportGuest: hydrated && canImportGuest,
    retrySync() { setReload(value => value + 1); },
    importGuestProgress() {
      if (!userId || !canImportGuest) return;
      const guest = readBrowserProgress(activeCourseId);
      if (guest) { update(() => guest.state); setCanImportGuest(false); }
    },
    async resolveConflict(useLocal) {
      const session = sessionRef.current;
      if (!session || session.scope !== scope || !session.userId) return;
      try {
        const response = await clientFetch("/api/me/learning-state?courseId=" + encodeURIComponent(activeCourseId), { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load progress");
        const data = await response.json() as { state: unknown; revision: string | null };
        const remote = data.state === null ? createLearningState() : parseProgressState(data.state);
        if (!remote || sessionRef.current !== session) return;
        if (!useLocal) {
          try { window.localStorage.setItem(scope + ":before-conflict", JSON.stringify(session.latest)); } catch { /* Optional backup. */ }
        }
        session.revision = data.revision; session.saved = JSON.stringify(remote); session.allowed = true;
        session.latest = useLocal ? session.latest : remote;
        cacheSession(session);
        setSnapshot({ scope, generation: reload, state: session.latest });
        setSync({ scope, status: useLocal ? "pending" : "saved" });
        if (useLocal) void saveSession(session);
      } catch { setSync({ scope, status: "offline" }); }
    },
    recordAnswer(skill, correct, activityId) { update(current => recordLearningAnswer(current, skill, correct, activityId)); },
    addXp(amount) {
      if (!Number.isFinite(amount) || amount <= 0) return;
      update(current => {
        const { state: base, today } = activateLearningDay(current);
        const xp = Math.round(amount);
        const daily = base.dailyStats[today] ?? { attempts: 0, correct: 0, xp: 0 };
        return { ...base, xp: base.xp + xp, todayXp: base.todayXp + xp, dailyStats: { ...base.dailyStats, [today]: { ...daily, xp: daily.xp + xp } } };
      });
    },
    setLessonProgress(lessonId, progress) { update(current => ({ ...current, lessonProgress: { ...current.lessonProgress, [lessonId]: Math.min(86, Math.max(0, Math.round(progress))) } })); },
    completeActivity(activityId, xp) { update(current => completeLearningActivity(current, activityId, xp)); },
    completeLessonSkill(lessonId, skill) { update(current => completeLearningSkill(current, lessonId, skill)); },
    completeLessonMastery(lessonId) { update(current => completeLearningMastery(current, lessonId)); },
    resetProgress() { update(() => createLearningState()); },
    resetForCourse(courseId) {
      const target = courseId ?? activeCourseId;
      if (target === activeCourseId) update(() => createLearningState());
      else {
        try { window.localStorage.removeItem(progressStorageKey(target, userId)); } catch { /* Optional cache. */ }
      }
    },
  }), [state, hydrated, syncStatus, canImportGuest, userId, activeCourseId, update, scope, saveSession, reload]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error("useLearning must be used inside LearningProvider");
  return context;
}
export function accuracy(stat: SkillStat) { return stat.total ? Math.round((stat.correct / stat.total) * 100) : 0; }
export function todayKey() { return localDateKey(); }
export function lastNDays(count: number) { return Array.from({ length: count }, (_, index) => shiftedDateKey(index - count + 1)); }
