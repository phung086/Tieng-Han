import { StudySession } from "@/components/study-session";

export default async function PracticeQuizPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="practice-session-page"><StudySession lessonId={Number(lesson ?? 3)} /></div>;
}
