import type { SkillKey } from "@/lib/learning-state";

type SkillStat = {
  correct: number;
  total: number;
};

type DailyStat = {
  attempts: number;
  correct: number;
  xp: number;
};

type MasteryItem = {
  strength: number;
  lastReviewed: string;
  dueAt: string;
};

export type LearningAnalyticsState = {
  dailyGoal: number;
  todayXp: number;
  lessonProgress: Record<string, number>;
  skills: Record<SkillKey, SkillStat>;
  dailyStats: Record<string, DailyStat>;
  mastery: Record<string, MasteryItem>;
};

export type SkillAnalytics = {
  key: SkillKey;
  accuracy: number;
  attempts: number;
};

export type LearningAnalytics = {
  goalPercent: number;
  goalRemaining: number;
  activeDays: number;
  recentAttempts: number;
  recentAccuracy: number;
  previousAccuracy: number | null;
  accuracyDelta: number | null;
  averageLessonProgress: number;
  completedLessons: number;
  dueReviews: number;
  fragileReviews: number;
  masteredItems: number;
  strongestSkill: SkillAnalytics | null;
  weakestSkill: SkillAnalytics | null;
};

function percentage(correct: number, total: number) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function summarizeDays(
  dailyStats: LearningAnalyticsState["dailyStats"],
  keys: string[],
) {
  return keys.reduce(
    (summary, key) => {
      const day = dailyStats[key];
      if (!day) return summary;

      summary.attempts += day.attempts;
      summary.correct += day.correct;
      if (day.attempts > 0 || day.xp > 0) {
        summary.activeDays += 1;
      }

      return summary;
    },
    { attempts: 0, correct: 0, activeDays: 0 },
  );
}

export function buildLearningAnalytics(
  state: LearningAnalyticsState,
  today: string,
  recentDayKeys: string[],
  previousDayKeys: string[],
): LearningAnalytics {
  const recent = summarizeDays(state.dailyStats, recentDayKeys);
  const previous = summarizeDays(state.dailyStats, previousDayKeys);
  const recentAccuracy = percentage(recent.correct, recent.attempts);
  const previousAccuracy =
    previous.attempts > 0
      ? percentage(previous.correct, previous.attempts)
      : null;

  const skillRows = (Object.entries(state.skills) as Array<
    [SkillKey, SkillStat]
  >)
    .filter(([, stat]) => stat.total > 0)
    .map(([key, stat]) => ({
      key,
      attempts: stat.total,
      accuracy: percentage(stat.correct, stat.total),
    }));

  const strongestSkill = skillRows.length
    ? [...skillRows].sort(
        (a, b) =>
          b.accuracy - a.accuracy ||
          b.attempts - a.attempts ||
          a.key.localeCompare(b.key),
      )[0]
    : null;

  const weakestSkill = skillRows.length
    ? [...skillRows].sort(
        (a, b) =>
          a.accuracy - b.accuracy ||
          b.attempts - a.attempts ||
          a.key.localeCompare(b.key),
      )[0]
    : null;

  const lessonProgress = Object.values(state.lessonProgress);
  const averageLessonProgress = lessonProgress.length
    ? Math.round(
        lessonProgress.reduce((sum, value) => sum + value, 0) /
          lessonProgress.length,
      )
    : 0;

  const masteryItems = Object.values(state.mastery);

  return {
    goalPercent:
      state.dailyGoal > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((state.todayXp / state.dailyGoal) * 100)),
          )
        : 0,
    goalRemaining: Math.max(0, state.dailyGoal - state.todayXp),
    activeDays: recent.activeDays,
    recentAttempts: recent.attempts,
    recentAccuracy,
    previousAccuracy,
    accuracyDelta:
      previousAccuracy === null ? null : recentAccuracy - previousAccuracy,
    averageLessonProgress,
    completedLessons: lessonProgress.filter((value) => value >= 100).length,
    dueReviews: masteryItems.filter((item) => item.dueAt <= today).length,
    fragileReviews: masteryItems.filter((item) => item.strength < 60).length,
    masteredItems: masteryItems.filter((item) => item.strength >= 80).length,
    strongestSkill,
    weakestSkill,
  };
}
