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
  /** Optional caller assertion; the actual motif is read from the question bank. */
  motif?: string;
};
export type PracticeQuestionEvidence = {
  id: string;
  lessonId: number;
  motif?: string;
};
export type InventoryParity = {
  sourceCount: number;
  coveredCount: number;
  missingIds: string[];
  uncertainIds: string[];
  motifMismatchIds: string[];
  unknownReferences: string[];
  danglingQuestionIds: string[];
  duplicateIds: string[];
  complete: boolean;
};

type LinkedEvidence = {
  evidence: PracticeEvidence;
  question: PracticeQuestionEvidence;
};

export function compareInventoryToPractice(
  inventory: SourceInventoryItem[],
  evidence: PracticeEvidence[],
  questions: PracticeQuestionEvidence[],
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

  const questionByKey = new Map<string, PracticeQuestionEvidence>();
  for (const question of questions) {
    if (question.id.trim()) questionByKey.set(question.lessonId + ":" + question.id, question);
  }

  const mappings = new Map<string, LinkedEvidence[]>();
  const unknownReferences: string[] = [];
  const danglingQuestionIds: string[] = [];
  for (const entry of evidence) {
    const key = entry.lessonId + ":" + entry.sourceItemId;
    if (!valid.has(key)) {
      unknownReferences.push(key);
      continue;
    }
    const questionKey = entry.lessonId + ":" + entry.questionId;
    const question = entry.questionId.trim() ? questionByKey.get(questionKey) : undefined;
    if (!question) {
      danglingQuestionIds.push(questionKey);
      continue;
    }
    mappings.set(key, [...(mappings.get(key) ?? []), { evidence: entry, question }]);
  }

  const missingIds: string[] = [];
  const uncertainIds: string[] = [];
  const motifMismatchIds: string[] = [];
  let coveredCount = 0;
  for (const item of inventory) {
    const key = item.lessonId + ":" + item.id;
    if (!item.verified || !valid.has(key)) {
      uncertainIds.push(key);
      continue;
    }
    const linked = mappings.get(key) ?? [];
    if (linked.length === 0) {
      missingIds.push(key);
      continue;
    }
    if (item.motif && !linked.some(({ evidence: entry, question }) =>
      question.motif === item.motif && (entry.motif === undefined || entry.motif === question.motif))) {
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
    danglingQuestionIds,
    duplicateIds,
    complete: inventory.length > 0 && coveredCount === inventory.length &&
      missingIds.length === 0 && uncertainIds.length === 0 && motifMismatchIds.length === 0 &&
      duplicateIds.length === 0 && unknownReferences.length === 0 && danglingQuestionIds.length === 0,
  };
}
