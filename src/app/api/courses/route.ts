import { NextResponse } from "next/server";
import {
  getActiveCourse,
  getCourseLibrary,
} from "@/lib/course-consumer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [courses, activeCourse] = await Promise.all([
      getCourseLibrary(),
      getActiveCourse(),
    ]);

    return NextResponse.json({
      courses,
      activeCourseId: activeCourse?.id ?? courses[0]?.id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc thư viện giáo trình.",
      },
      { status: 500 },
    );
  }
}
