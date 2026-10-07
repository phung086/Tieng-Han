import { NextResponse } from "next/server";
import { getActiveCourse } from "@/lib/course-consumer";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getCourseStatusMap,
  syncCourseCatalog,
} from "@/lib/db/course-catalog";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [course, user] = await Promise.all([
      getActiveCourse(),
      getCurrentUser(),
    ]);

    if (!course || !isDatabaseConfigured()) {
      return NextResponse.json({ course });
    }

    await syncCourseCatalog([
      {
        id: course.id,
        title: course.title,
        level: course.level,
        source: course.source,
      },
    ]);

    if (user?.role !== "admin") {
      const statusMap = await getCourseStatusMap([course.id]);
      if (statusMap.get(course.id) !== "published") {
        return NextResponse.json({ course: null });
      }
    }

    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc thông tin khóa học.",
      },
      { status: 500 },
    );
  }
}
