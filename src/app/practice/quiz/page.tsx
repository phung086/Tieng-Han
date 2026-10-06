import {
  StudySession,
  type StudySessionMode,
} from "@/components/study-session";
import type { SkillKey } from "@/lib/learning-state";

const validModes = new Set<StudySessionMode>([
  "guided",
  "quick",
  "mastery",
]);

const validSkills = new Set<SkillKey>([
  "vocabulary",
  "grammar",
  "listening",
  "speaking",
  "reading",
  "writing",
]);

export default async function PracticeQuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    lesson?: string;
    mode?: string;
    skill?: string;
  }>;
}) {
  const { lesson, mode, skill } = await searchParams;
  const parsedMode = validModes.has(mode as StudySessionMode)
    ? (mode as StudySessionMode)
    : "guided";
  const parsedSkill = validSkills.has(skill as SkillKey)
    ? (skill as SkillKey)
    : undefined;

  return (
    <div className="practice-session-page">
      <StudySession
        lessonId={lesson ? Number(lesson) : undefined}
        mode={parsedMode}
        skill={parsedSkill}
      />
    </div>
  );
}
