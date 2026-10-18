import { NextResponse } from "next/server";
import { resolveCourseSource, sourceHeaders } from "@/lib/course-source-access";
import { buildLessonBook } from "@/lib/lesson-book";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const source = await resolveCourseSource(courseId);
  if ("error" in source) return NextResponse.json({ error: source.error }, { status: source.status, headers: sourceHeaders });
  const lessonId = Number(new URL(request.url).searchParams.get("lesson"));
  const lesson = source.course.lessons.find(item => item.id === lessonId);
  if (!Number.isSafeInteger(lessonId) || !lesson) return NextResponse.json({ error: "Không tìm thấy bài học trong giáo trình." }, { status: 404, headers: sourceHeaders });
  return NextResponse.json(buildLessonBook(lesson, source.job.documents), { headers: sourceHeaders });
}
