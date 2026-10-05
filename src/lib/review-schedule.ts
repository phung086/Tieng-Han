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
