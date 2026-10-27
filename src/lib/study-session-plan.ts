export function pickBalancedQuestions<T extends { skill: string }>(
  items: T[],
  limit?: number,
) {
  // Guided/mastery defaults to the full bank. A limit is only for an
  // explicitly bounded mode such as Quick 5; it must never be implicit.
  const target =
    limit === undefined || !Number.isFinite(limit)
      ? items.length
      : Math.min(items.length, Math.max(0, Math.floor(limit)));
  if (target === 0) return [];

  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const bucket = buckets.get(item.skill) ?? [];
    bucket.push(item);
    buckets.set(item.skill, bucket);
  }

  const preferredSkills = [
    "vocabulary",
    "grammar",
    "listening",
    "speaking",
    "reading",
    "writing",
  ];
  const preferredSet = new Set(preferredSkills);
  const orderedSkills = [
    ...preferredSkills,
    ...Array.from(buckets.keys()).filter((skill) => !preferredSet.has(skill)),
  ];

  const selected: T[] = [];
  while (selected.length < target) {
    let added = false;

    for (const skill of orderedSkills) {
      const bucket = buckets.get(skill);
      const next = bucket?.shift();
      if (!next) continue;

      selected.push(next);
      added = true;
      if (selected.length >= target) break;
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
