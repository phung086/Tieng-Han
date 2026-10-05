"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  resetForCourse: () => void;
};

const STORAGE_KEY = "haneul-learning-state-v2";
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
  lessonProgress: { "1": 100, "2": 100, "3": 0 },
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
  const [state, setState] = useState(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let savedState: LearningState | null = null;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) savedState = normalizeLoadedState(JSON.parse(saved));
    } catch {
      // Persistence is optional; the app still works when storage is unavailable.
    }

    const timer = window.setTimeout(() => {
      if (savedState) setState(savedState);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

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
          const interval = correct ? (strength >= 85 ? 7 : strength >= 65 ? 3 : 1) : 0;
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
      window.localStorage.removeItem(STORAGE_KEY);
    },
    resetForCourse() {
      setState({
        ...defaultState,
        lessonProgress: {},
      });
      window.localStorage.removeItem(STORAGE_KEY);
    },
  }), [state, hydrated]);

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
