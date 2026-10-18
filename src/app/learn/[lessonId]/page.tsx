import { LessonWorkspace } from "@/components/lesson-workspace";

export default async function LessonPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ page?: string; file?: string }> }) {
  const [{ lessonId }, query] = await Promise.all([params, searchParams]);
  const page = Number(query.page);
  return <div className="page"><LessonWorkspace lessonId={Number(lessonId)} initialPage={Number.isSafeInteger(page) && page > 0 ? page : undefined} initialFile={query.file} /></div>;
}
