import {
  StudySession,
  type StudySessionMode,
} from "@/components/study-session";

const validModes = new Set<StudySessionMode>([
  "guided",
  "quick",
  "mastery",
]);

export default async function PracticeQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; mode?: string }>;
}) {
  const { lesson, mode } = await searchParams;
  const parsedMode = validModes.has(mode as StudySessionMode)
    ? (mode as StudySessionMode)
    : "guided";

  return (
    <div className="practice-session-page">
      <StudySession
        lessonId={lesson ? Number(lesson) : undefined}
        mode={parsedMode}
      />
    </div>
  );
}
