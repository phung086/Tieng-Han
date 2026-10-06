"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { nextReviewIntervalDays } from "@/lib/review-schedule";
import { useContent } from "@/lib/content-store";
import { useAuth } from "@/lib/auth-client";

export type SkillKey = "vocabulary" | "grammar" | "listening" | "speaking" | "reading" | "writing";
type SkillStat = { correct: number; total: number };
type DailyStat = { attempts: number; correct: number; xp: number };
type MasteryItem = { strength: number; lastReviewed: string; dueAt: string };

type LearningState = {
  version: 2;
  xp: number;
  streak: number;
  dailyGoal: number;
  todayXp: number;
  lastActiveDate: string | null;
  lessonProgress: Record<string, number>;
  skills: Record<SkillKey, SkillStat>;
  completedActivities: string[];
  dailyStats: Record<string, DailyStat>;
  mastery: Record<string, MasteryItem>;
};

type LearningContextValue = {
  state: LearningState;
  hydrated: boolean;
  recordAnswer: (skill: SkillKey, correct: boolean, activityId?: string) => void;
  addXp: (amount: number) => void;
  setLessonProgress: (lessonId: number, progress: number) => void;
  completeActivity: (activityId: string, xp?: number) => void;
  completeLessonSkill: (lessonId: number, skill: SkillKey) => void;
  resetProgress: () => void;
  resetForCourse: (courseId?: string) => void;
};

const LEGACY_STORAGE_KEY = "haneul-learning-state-v2";
const STORAGE_KEY_PREFIX = "haneul-learning-state-v2:";
const ALL_SKILLS: SkillKey[] = ["vocabulary", "grammar", "listening", "speaking", "reading", "writing"];
const DAY_MS = 86_400_000;

function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDaysKey(days: number) {
  return dateKey(new Date(Date.now() + days * DAY_MS));
}

function yesterdayKey() {
  return dateKey(new Date(Date.now() - DAY_MS));
}

const defaultState: LearningState = {
  version: 2,
  xp: 0,
  streak: 0,
  dailyGoal: 50,
  todayXp: 0,
  lastActiveDate: null,
  lessonProgress: {},
  skills: {
    vocabulary: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    speaking: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
    writing: { correct: 0, total: 0 },
  },
  completedActivities: [],
  dailyStats: {},
  mastery: {},
};

const LearningContext = createContext<LearningContextValue | null>(null);

function normalizeLoadedState(raw: Partial<LearningState>): LearningState {
  return {
    ...defaultState,
    ...raw,
    version: 2,
    skills: { ...defaultState.skills, ...(raw.skills ?? {}) },
    lessonProgress: { ...defaultState.lessonProgress, ...(raw.lessonProgress ?? {}) },
    dailyStats: raw.dailyStats ?? {},
    mastery: raw.mastery ?? {},
    completedActivities: raw.completedActivities ?? [],
  };
}

function withActiveDay(current: LearningState) {
  const today = dateKey();
  if (current.lastActiveDate === today) {
    return { state: current, today };
  }

  const streak = current.lastActiveDate === yesterdayKey() ? Math.max(1, current.streak + 1) : 1;

  return {
    today,
    state: {
      ...current,
      streak,
      todayXp: 0,
      lastActiveDate: today,
    },
  };
}

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const { activeCourseId, hydrated: contentHydrated } = useContent();
  const { user } = useAuth();
  const [state, setState] = useState(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const loadedCourseIdRef = useRef<string | null>(null);
  const loadRunRef = useRef(0);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!contentHydrated || activeCourseId === "empty") return;

    const runId = loadRunRef.current + 1;
    loadRunRef.current = runId;
    loadedCourseIdRef.current = null;
    setHydrated(false);

    const storageKey = STORAGE_KEY_PREFIX + activeCourseId;
    let localState: LearningState | null = null;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        localState = normalizeLoadedState(JSON.parse(saved));
      } else {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          localState = normalizeLoadedState(JSON.parse(legacy));
          window.localStorage.setItem(storageKey, legacy);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch {
      // Browser persistence is optional.
    }

    async function hydrate() {
      let nextState = localState ?? defaultState;

      if (user) {
        try {
          const response = await fetch(
            "/api/me/learning-state?courseId=" +
              encodeURIComponent(activeCourseId),
            { cache: "no-store" },
          );

          if (response.ok) {
            const data = (await response.json()) as {
              state?: Partial<LearningState> | null;
            };
            if (data.state) {
              nextState = normalizeLoadedState(data.state);
            }
          }
        } catch {
          // Fall back to the course-scoped browser state.
        }
      }

      if (loadRunRef.current !== runId) return;

      loadedCourseIdRef.current = activeCourseId;
      setState(nextState);
      setHydrated(true);
    }

    void hydrate();

    return () => {
      if (loadRunRef.current === runId) {
        loadRunRef.current += 1;
      }
    };
  }, [activeCourseId, contentHydrated, user]);

  useEffect(() => {
    if (
      !hydrated ||
      activeCourseId === "empty" ||
      loadedCourseIdRef.current !== activeCourseId
    ) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY_PREFIX + activeCourseId,
        JSON.stringify(state),
      );
    } catch {
      // Account sync can still work if localStorage is unavailable.
    }

    if (!user) return;

    if (serverSaveTimerRef.current) {
      window.clearTimeout(serverSaveTimerRef.current);
    }

    serverSaveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/me/learning-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId: activeCourseId,
          state,
        }),
      }).catch(() => undefined);
    }, 650);

    return () => {
      if (serverSaveTimerRef.current) {
        window.clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = null;
      }
    };
  }, [state, hydrated, activeCourseId, user]);


  const value = useMemo<LearningContextValue>(() => ({
    state,
    hydrated,
    recordAnswer(skill, correct, activityId) {
      setState((current) => {
        const active = withActiveDay(current);
        const base = active.state;
        const currentSkill = base.skills[skill];
        const gained = correct ? 10 : 2;
        const todayStat = base.dailyStats[active.today] ?? { attempts: 0, correct: 0, xp: 0 };

        let mastery = base.mastery;
        if (activityId) {
          const previous = base.mastery[activityId] ?? { strength: 35, lastReviewed: active.today, dueAt: active.today };
          const strength = correct
            ? Math.min(100, previous.strength + 15)
            : Math.max(0, previous.strength - 20);
          const interval = nextReviewIntervalDays(strength, correct);
          mastery = {
            ...base.mastery,
            [activityId]: {
              strength,
              lastReviewed: active.today,
              dueAt: interval === 0 ? active.today : addDaysKey(interval),
            },
          };
        }

        return {
          ...base,
          xp: base.xp + gained,
          todayXp: base.todayXp + gained,
          skills: {
            ...base.skills,
            [skill]: {
              correct: currentSkill.correct + (correct ? 1 : 0),
              total: currentSkill.total + 1,
            },
          },
          dailyStats: {
            ...base.dailyStats,
            [active.today]: {
              attempts: todayStat.attempts + 1,
              correct: todayStat.correct + (correct ? 1 : 0),
              xp: todayStat.xp + gained,
            },
          },
          mastery,
          completedActivities:
            activityId && correct && !base.completedActivities.includes(activityId)
              ? [...base.completedActivities, activityId]
              : base.completedActivities,
        };
      });
    },
    addXp(amount) {
      setState((current) => {
        const active = withActiveDay(current);
        const todayStat = active.state.dailyStats[active.today] ?? { attempts: 0, correct: 0, xp: 0 };
        return {
          ...active.state,
          xp: active.state.xp + amount,
          todayXp: active.state.todayXp + amount,
          dailyStats: {
            ...active.state.dailyStats,
            [active.today]: { ...todayStat, xp: todayStat.xp + amount },
          },
        };
      });
    },
    setLessonProgress(lessonId, progress) {
      setState((current) => ({
        ...current,
        lessonProgress: {
          ...current.lessonProgress,
          [String(lessonId)]: Math.max(0, Math.min(100, Math.round(progress))),
        },
      }));
    },
    completeActivity(activityId, xp = 10) {
      setState((current) => {
        if (current.completedActivities.includes(activityId)) return current;
        const active = withActiveDay(current);
        const todayStat = active.state.dailyStats[active.today] ?? { attempts: 0, correct: 0, xp: 0 };
        return {
          ...active.state,
          xp: active.state.xp + xp,
          todayXp: active.state.todayXp + xp,
          completedActivities: [...active.state.completedActivities, activityId],
          dailyStats: {
            ...active.state.dailyStats,
            [active.today]: { ...todayStat, xp: todayStat.xp + xp },
          },
        };
      });
    },
    completeLessonSkill(lessonId, skill) {
      setState((current) => {
        const activityId = `lesson:${lessonId}:${skill}`;
        const alreadyCompleted = current.completedActivities.includes(activityId);
        const completedActivities = alreadyCompleted
          ? current.completedActivities
          : [...current.completedActivities, activityId];
        const completedCount = ALL_SKILLS.filter((item) =>
          completedActivities.includes(`lesson:${lessonId}:${item}`)
        ).length;
        const progress = Math.round((completedCount / ALL_SKILLS.length) * 100);

        if (alreadyCompleted) {
          return {
            ...current,
            lessonProgress: { ...current.lessonProgress, [String(lessonId)]: progress },
          };
        }

        const active = withActiveDay(current);
        const todayStat = active.state.dailyStats[active.today] ?? { attempts: 0, correct: 0, xp: 0 };

        return {
          ...active.state,
          xp: active.state.xp + 15,
          todayXp: active.state.todayXp + 15,
          completedActivities,
          lessonProgress: { ...active.state.lessonProgress, [String(lessonId)]: progress },
          dailyStats: {
            ...active.state.dailyStats,
            [active.today]: { ...todayStat, xp: todayStat.xp + 15 },
          },
        };
      });
    },
    resetProgress() {
      setState(defaultState);
      if (activeCourseId !== "empty") {
        window.localStorage.removeItem(STORAGE_KEY_PREFIX + activeCourseId);
      }
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    },
    resetForCourse(courseId) {
      const targetCourseId = courseId ?? activeCourseId;
      if (targetCourseId === activeCourseId) {
        setState({
          ...defaultState,
          lessonProgress: {},
        });
      }
      if (targetCourseId !== "empty") {
        window.localStorage.removeItem(
          STORAGE_KEY_PREFIX + targetCourseId,
        );
      }
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    },
  }), [state, hydrated, activeCourseId]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error("useLearning must be used inside LearningProvider");
  return context;
}

export function accuracy(stat: SkillStat) {
  return stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
}

export function todayKey() {
  return dateKey();
}

export function lastNDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    return dateKey(new Date(Date.now() - offset * DAY_MS));
  });
}
