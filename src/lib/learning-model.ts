import { advanceMastery, type MasteryItem } from "@/lib/review-schedule";

export const ALL_SKILLS = ["vocabulary", "grammar", "listening", "speaking", "reading", "writing"] as const;
export type SkillKey = (typeof ALL_SKILLS)[number];
export type SkillStat = { correct: number; total: number };
export type LearningState = {
  version: 2;
  xp: number;
  streak: number;
  dailyGoal: number;
  todayXp: number;
  lastActiveDate: string | null;
  lessonProgress: Record<string, number>;
  skills: Record<SkillKey, SkillStat>;
  completedActivities: string[];
  dailyStats: Record<string, { attempts: number; correct: number; xp: number }>;
  mastery: Record<string, MasteryItem>;
};

export function createLearningState(): LearningState {
  return {
    version: 2, xp: 0, streak: 0, dailyGoal: 50, todayXp: 0, lastActiveDate: null,
    lessonProgress: {}, completedActivities: [], dailyStats: {}, mastery: {},
    skills: Object.fromEntries(ALL_SKILLS.map(skill => [skill, { correct: 0, total: 0 }])) as LearningState["skills"],
  };
}

export function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function shiftedDateKey(days: number, date = new Date()) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return localDateKey(shifted);
}

export function refreshLearningDay(state: LearningState, date = new Date()): LearningState {
  if (state.lastActiveDate === localDateKey(date)) return state;
  const streak = state.lastActiveDate === shiftedDateKey(-1, date) ? state.streak : 0;
  return state.todayXp === 0 && state.streak === streak ? state : { ...state, todayXp: 0, streak };
}

export function activateLearningDay(state: LearningState, date = new Date()) {
  const today = localDateKey(date);
  if (state.lastActiveDate === today) return { state, today };
  return {
    today,
    state: {
      ...state, todayXp: 0, lastActiveDate: today,
      streak: state.lastActiveDate === shiftedDateKey(-1, date) ? Math.max(1, state.streak + 1) : 1,
    },
  };
}

export function lessonSkillCount(state: LearningState, lessonId: number) {
  return ALL_SKILLS.filter(skill => state.completedActivities.includes(`lesson:${lessonId}:${skill}`)).length;
}

export function lessonCompletionProgress(state: LearningState, lessonId: number) {
  const skills = lessonSkillCount(state, lessonId);
  const passedMastery = state.completedActivities.includes(`lesson:${lessonId}:mastery`);
  return Math.round(((skills + (skills === 6 && passedMastery ? 1 : 0)) / 7) * 100);
}

export function normalizeLessonProgress(state: LearningState): LearningState {
  const lessonProgress = { ...state.lessonProgress };
  for (const id of Object.keys(lessonProgress)) {
    if (state.completedActivities.some(activity => activity.startsWith(`lesson:${id}:`))) {
      lessonProgress[id] = lessonCompletionProgress(state, Number(id));
    } else if (lessonProgress[id] >= 100) {
      // Preserve legacy study effort, but require the final check for completion.
      lessonProgress[id] = 86;
    }
  }
  return { ...state, lessonProgress };
}

export function recordLearningAnswer(current: LearningState, skill: SkillKey, correct: boolean, activityId?: string, date = new Date()): LearningState {
  const { state: base, today } = activateLearningDay(current, date);
  const gained = correct ? 10 : 2;
  const stat = base.skills[skill];
  const daily = base.dailyStats[today] ?? { attempts: 0, correct: 0, xp: 0 };
  return {
    ...base, xp: base.xp + gained, todayXp: base.todayXp + gained,
    skills: { ...base.skills, [skill]: { correct: stat.correct + Number(correct), total: stat.total + 1 } },
    dailyStats: { ...base.dailyStats, [today]: { attempts: daily.attempts + 1, correct: daily.correct + Number(correct), xp: daily.xp + gained } },
    mastery: activityId ? { ...base.mastery, [activityId]: advanceMastery(base.mastery[activityId], correct, today) } : base.mastery,
    completedActivities: activityId && correct && !base.completedActivities.includes(activityId) ? [...base.completedActivities, activityId] : base.completedActivities,
  };
}

export function completeLearningActivity(current: LearningState, activityId: string, xp = 10): LearningState {
  if (current.completedActivities.includes(activityId)) return current;
  const { state: base, today } = activateLearningDay(current);
  const daily = base.dailyStats[today] ?? { attempts: 0, correct: 0, xp: 0 };
  return {
    ...base, xp: base.xp + xp, todayXp: base.todayXp + xp,
    completedActivities: [...base.completedActivities, activityId],
    dailyStats: { ...base.dailyStats, [today]: { ...daily, xp: daily.xp + xp } },
  };
}

export function completeLearningSkill(current: LearningState, lessonId: number, skill: SkillKey): LearningState {
  const next = completeLearningActivity(current, `lesson:${lessonId}:${skill}`, 15);
  return { ...next, lessonProgress: { ...next.lessonProgress, [lessonId]: lessonCompletionProgress(next, lessonId) } };
}

export function completeLearningMastery(current: LearningState, lessonId: number): LearningState {
  if (lessonSkillCount(current, lessonId) !== ALL_SKILLS.length) return current;
  const next = completeLearningActivity(current, `lesson:${lessonId}:mastery`, 20);
  return { ...next, lessonProgress: { ...next.lessonProgress, [lessonId]: 100 } };
}
