import type { SkillKey } from "@/lib/learning-state";

export const CORE_LESSON_SKILLS = [
  "vocabulary",
  "grammar",
] as const satisfies readonly SkillKey[];

export const OPTIONAL_LESSON_SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
] as const satisfies readonly SkillKey[];

export function getRequiredCoreSkills(input?: {
  hasVocabulary?: boolean;
  hasGrammar?: boolean;
}): SkillKey[] {
  const hasVocabulary = input?.hasVocabulary ?? true;
  const hasGrammar = input?.hasGrammar ?? true;

  return [
    ...(hasVocabulary ? (["vocabulary"] as SkillKey[]) : []),
    ...(hasGrammar ? (["grammar"] as SkillKey[]) : []),
  ];
}

export function lessonSkillActivityId(
  lessonId: number,
  skill: SkillKey,
) {
  return `lesson:${lessonId}:${skill}`;
}

export function getCoreLessonProgress(
  completedActivities: string[],
  lessonId: number,
  requiredSkills: SkillKey[] = [...CORE_LESSON_SKILLS],
) {
  if (!requiredSkills.length) return 100;

  const completed = requiredSkills.filter((skill) =>
    completedActivities.includes(lessonSkillActivityId(lessonId, skill)),
  ).length;

  return Math.round((completed / requiredSkills.length) * 100);
}

export function isLessonCoreComplete(
  completedActivities: string[],
  lessonId: number,
  requiredSkills: SkillKey[] = [...CORE_LESSON_SKILLS],
) {
  return getCoreLessonProgress(
    completedActivities,
    lessonId,
    requiredSkills,
  ) >= 100;
}
