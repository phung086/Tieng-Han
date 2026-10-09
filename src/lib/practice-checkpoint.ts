import type { StudyQuestion } from "@/data/content";
import type { SkillKey } from "@/lib/learning-state";

export type PracticeCheckpoint = {
  index: number;
  correctCount: number;
  mistakeIds: string[];
  skillStats: Partial<Record<SkillKey, { correct: number; total: number }>>;
};

type PersistedPracticeCheckpoint = PracticeCheckpoint & {
  version: 1;
  questionIds: string[];
  contentSignature: string;
  savedAt: number;
};

const VALID_SKILLS = new Set<SkillKey>([
  "vocabulary", "grammar", "listening", "speaking", "reading", "writing",
]);

export function practiceCheckpointKey(
  courseId: string,
  lessonId: number,
  mode: string,
  skill?: SkillKey,
): string {
  return ["haneul-practice-checkpoint-v1", encodeURIComponent(courseId), lessonId, mode, skill ?? "all"].join(":");
}

function questionContentSignature(questions: StudyQuestion[]): string {
  const content = JSON.stringify(
    questions.map(question => [question.id, question.prompt, question.answer, question.type, question.choices]),
  );
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
  }
  return String(hash >>> 0);
}

export function serializePracticeCheckpoint(
  questions: StudyQuestion[],
  data: PracticeCheckpoint,
): string {
  const saved: PersistedPracticeCheckpoint = {
    version: 1,
    questionIds: questions.map(question => question.id),
    contentSignature: questionContentSignature(questions),
    index: data.index,
    correctCount: data.correctCount,
    mistakeIds: data.mistakeIds,
    skillStats: data.skillStats,
    savedAt: Date.now(),
  };
  return JSON.stringify(saved);
}

/** Returns null for corrupt, outdated or recompiled lesson banks. */
export function parsePracticeCheckpoint(
  input: string | null,
  questions: StudyQuestion[],
): PracticeCheckpoint | null {
  if (!input || !questions.length) return null;
  let row: unknown;
  try { row = JSON.parse(input); }
  catch { return null; }
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const data = row as Partial<PersistedPracticeCheckpoint>;
  if (data.version !== 1 || !Array.isArray(data.questionIds)) return null;
  if (data.questionIds.length !== questions.length) return null;
  if (data.contentSignature !== questionContentSignature(questions)) return null;
  if (!questions.every((question, index) => question.id === data.questionIds?.[index])) return null;
  if (!Number.isSafeInteger(data.index) || (data.index ?? -1) < 1 || (data.index ?? Infinity) >= questions.length) return null;
  if (!Number.isSafeInteger(data.correctCount) || (data.correctCount ?? -1) < 0 || (data.correctCount ?? Infinity) > (data.index ?? 0)) return null;
  if (!Number.isFinite(data.savedAt) || (data.savedAt ?? 0) > Date.now() + 3600000) return null;
  // Stale sessions do not overwrite fresh current course progress indefinitely.
  if ((data.savedAt ?? 0) < Date.now() - 180 * 24 * 60 * 60 * 1000) return null;
  const ids = new Set(questions.map(question => question.id));
  if (!Array.isArray(data.mistakeIds) ||
      !data.mistakeIds.every(id => typeof id === "string" && ids.has(id))) return null;
  const stats = data.skillStats;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return null;
  for (const [key, val] of Object.entries(stats)) {
    if (!VALID_SKILLS.has(key as SkillKey) || !val ||
        !Number.isSafeInteger(val.correct) || !Number.isSafeInteger(val.total) ||
        val.correct < 0 || val.total < 0 || val.correct > val.total) return null;
  }
  return {
    index: data.index as number,
    correctCount: data.correctCount as number,
    mistakeIds: data.mistakeIds,
    skillStats: stats,
  };
}
