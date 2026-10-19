export type MasteryItem = {
  strength: number;
  lastReviewed: string;
  dueAt: string;
  lastResult?: boolean;
  lastWrongAt?: string;
};

export function nextReviewIntervalDays(
  strength: number,
  correct: boolean,
) {
  if (!correct) return 0;

  if (strength >= 95) return 30;
  if (strength >= 85) return 14;
  if (strength >= 75) return 7;
  if (strength >= 60) return 3;
  return 1;
}

export function advanceMastery(previous: MasteryItem | undefined, correct: boolean, today: string): MasteryItem {
  if (correct && previous?.lastReviewed === today && previous.lastResult === true) {
    return previous;
  }
  const strength = correct
    ? Math.min(100, (previous?.strength ?? 35) + 15)
    : Math.max(0, (previous?.strength ?? 35) - 20);
  const lastWrongAt = correct ? previous?.lastWrongAt : today;
  const interval = Math.min(
    nextReviewIntervalDays(strength, correct),
    lastWrongAt === today ? 1 : 30,
  );
  const due = new Date(today + "T12:00:00Z");
  due.setUTCDate(due.getUTCDate() + interval);
  return { strength, lastReviewed: today, dueAt: due.toISOString().slice(0, 10), lastResult: correct, ...(lastWrongAt ? { lastWrongAt } : {}) };
}
