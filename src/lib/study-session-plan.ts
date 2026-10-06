export function pickBalancedQuestions<T extends { skill: string }>(
  items: T[],
  limit = 8,
) {
  if (items.length <= limit) return items;

  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const bucket = buckets.get(item.skill) ?? [];
    bucket.push(item);
    buckets.set(item.skill, bucket);
  }

  const selected: T[] = [];
  const orderedSkills = [
    "vocabulary",
    "grammar",
    "listening",
    "speaking",
    "reading",
    "writing",
  ];

  while (selected.length < limit) {
    let added = false;

    for (const skill of orderedSkills) {
      const bucket = buckets.get(skill);
      const next = bucket?.shift();
      if (!next) continue;

      selected.push(next);
      added = true;
      if (selected.length >= limit) break;
    }

    if (!added) break;
  }

  return selected;
}

export function masteryPassed(
  correct: number,
  total: number,
  threshold = 0.75,
) {
  return total > 0 && correct / total >= threshold;
}
