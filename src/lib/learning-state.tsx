"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SkillKey = "vocabulary" | "grammar" | "listening" | "speaking" | "reading" | "writing";
type SkillStat = { correct: number; total: number };

type LearningState = {
  xp: number;
  streak: number;
  dailyGoal: number;
  todayXp: number;
  lessonProgress: Record<string, number>;
  skills: Record<SkillKey, SkillStat>;
  completedActivities: string[];
};

type LearningContextValue = {
  state: LearningState;
  hydrated: boolean;
  recordAnswer: (skill: SkillKey, correct: boolean, activityId?: string) => void;
  addXp: (amount: number) => void;
  setLessonProgress: (lessonId: number, progress: number) => void;
  completeActivity: (activityId: string, xp?: number) => void;
  resetProgress: () => void;
};

const STORAGE_KEY = "haneul-learning-state-v1";

const defaultState: LearningState = {
  xp: 320,
  streak: 7,
  dailyGoal: 50,
  todayXp: 26,
  lessonProgress: { "1": 100, "2": 100, "3": 62 },
  skills: {
    vocabulary: { correct: 41, total: 50 },
    grammar: { correct: 26, total: 35 },
    listening: { correct: 17, total: 28 },
    speaking: { correct: 11, total: 19 },
    reading: { correct: 22, total: 28 },
    writing: { correct: 14, total: 21 },
  },
  completedActivities: [],
};

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...defaultState, ...JSON.parse(saved) });
    } catch {
      // Persistence is optional; the app still works when storage is unavailable.
    } finally {
      setHydrated(true);
    }
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
        const currentSkill = current.skills[skill];
        const gained = correct ? 10 : 2;
        return {
          ...current,
          xp: current.xp + gained,
          todayXp: current.todayXp + gained,
          skills: {
            ...current.skills,
            [skill]: {
              correct: currentSkill.correct + (correct ? 1 : 0),
              total: currentSkill.total + 1,
            },
          },
          completedActivities: activityId && correct && !current.completedActivities.includes(activityId)
            ? [...current.completedActivities, activityId]
            : current.completedActivities,
        };
      });
    },
    addXp(amount) {
      setState((current) => ({ ...current, xp: current.xp + amount, todayXp: current.todayXp + amount }));
    },
    setLessonProgress(lessonId, progress) {
      setState((current) => ({
        ...current,
        lessonProgress: { ...current.lessonProgress, [String(lessonId)]: Math.max(0, Math.min(100, progress)) },
      }));
    },
    completeActivity(activityId, xp = 10) {
      setState((current) => {
        if (current.completedActivities.includes(activityId)) return current;
        return {
          ...current,
          xp: current.xp + xp,
          todayXp: current.todayXp + xp,
          completedActivities: [...current.completedActivities, activityId],
        };
      });
    },
    resetProgress() {
      setState(defaultState);
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
