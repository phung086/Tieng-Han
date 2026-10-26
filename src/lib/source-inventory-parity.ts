/** Read-only parity check against an independently reviewed textbook inventory. */
export type SourceInventoryItem = {
  id: string;
  lessonId: number;
  page: number;
  kind: string;
  motif?: string;
  verified: boolean;
};
export type PracticeEvidence = {
  sourceItemId: string;
  lessonId: number;
  questionId: string;
  motif?: string;
};
export type InventoryParity = {
  sourceCount: number;
  coveredCount: number;
  missingIds: string[];
  uncertainIds: string[];
  motifMismatchIds: string[];
  unknownReferences: string[];
  duplicateIds: string[];
  /** Question IDs mapped to more than one distinct source item. */
  reusedQuestionIds: string[];
  complete: boolean;
};

export function compareInventoryToPractice(
  inventory: SourceInventoryItem[],
  evidence: PracticeEvidence[],
): InventoryParity {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const valid = new Map<string, SourceInventoryItem>();
  for (const item of inventory) {
    const key = item.lessonId + ":" + item.id;
    if (seen.has(key)) duplicateIds.push(key);
    seen.add(key);
    if (item.id.trim() && Number.isInteger(item.page) && item.page > 0) valid.set(key, item);
  }
  // A duplicate source identity is ambiguous as a unit of coverage. Exclude
  // every occurrence of that key from the numerator rather than counting the
  // same practice evidence once per duplicate inventory row.
  const duplicateKeys = new Set(duplicateIds);
  const mappings = new Map<string, PracticeEvidence[]>();
  const questionOwners = new Map<string, Set<string>>();
  const unknownReferences: string[] = [];
  for (const entry of evidence) {
    const key = entry.lessonId + ":" + entry.sourceItemId;
    if (!valid.has(key)) {
      unknownReferences.push(key);
      continue;
    }
    const questionId = entry.questionId.trim();
    if (!questionId) continue;
    mappings.set(key, [...(mappings.get(key) ?? []), entry]);
    const owners = questionOwners.get(questionId) ?? new Set<string>();
    owners.add(key);
    questionOwners.set(questionId, owners);
  }
  const reusedQuestionIds = [...questionOwners.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([questionId]) => questionId)
    .sort();
  const reused = new Set(reusedQuestionIds);
  const missingIds: string[] = [];
  const uncertainIds: string[] = [];
  const motifMismatchIds: string[] = [];
  let coveredCount = 0;
  for (const item of inventory) {
    const key = item.lessonId + ":" + item.id;
    if (duplicateKeys.has(key)) continue;
    if (!item.verified || !valid.has(key)) {
      uncertainIds.push(key);
      continue;
    }
    // A single question cannot be evidence for multiple distinct source items.
    const linked = (mappings.get(key) ?? []).filter((entry) => !reused.has(entry.questionId.trim()));
    if (linked.length === 0) {
      missingIds.push(key);
      continue;
    }
    if (item.motif && !linked.some((entry) => entry.motif === item.motif)) {
      motifMismatchIds.push(key);
      continue;
    }
    coveredCount++;
  }
  return {
    sourceCount: inventory.length,
    coveredCount,
    missingIds,
    uncertainIds,
    motifMismatchIds,
    unknownReferences,
    duplicateIds,
    reusedQuestionIds,
    complete: inventory.length > 0 && coveredCount === inventory.length &&
      duplicateIds.length === 0 && unknownReferences.length === 0 && reusedQuestionIds.length === 0,
  };
}
