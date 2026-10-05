import { LessonWorkspace } from "@/components/lesson-workspace";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  return <div className="page"><LessonWorkspace lessonId={Number(lessonId)} /></div>;
}
