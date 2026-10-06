import { NextResponse } from "next/server";
import {
  getActiveCourse,
  getCourseLibrary,
} from "@/lib/course-consumer";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getCourseStatusMap,
  syncCourseCatalog,
} from "@/lib/db/course-catalog";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [allCourses, activeCourse, user] = await Promise.all([
      getCourseLibrary(),
      getActiveCourse(),
      getCurrentUser(),
    ]);

    let courses = allCourses;

    if (isDatabaseConfigured()) {
      await syncCourseCatalog(
        allCourses.map((course) => ({
          id: course.id,
          title: course.title,
          level: course.level,
          source: course.source,
        })),
      );

      if (user?.role !== "admin") {
        const statusMap = await getCourseStatusMap(
          allCourses.map((course) => course.id),
        );
        courses = allCourses.filter(
          (course) => statusMap.get(course.id) === "published",
        );
      }
    }

    const visibleActiveCourse =
      courses.find((course) => course.id === activeCourse?.id) ??
      courses[0] ??
      null;

    return NextResponse.json({
      courses,
      activeCourseId: visibleActiveCourse?.id ?? null,
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
