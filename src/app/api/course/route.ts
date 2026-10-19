import { NextResponse } from "next/server";
import { getActiveCourse, getCourseLibrary } from "@/lib/course-consumer";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getCourseStatusMap, syncCourseCatalog } from "@/lib/db/course-catalog";

export const runtime = "nodejs";

export async function GET() {
  try {
    let course = await getActiveCourse();
    if (isDatabaseConfigured()) {
      const [courses, user] = await Promise.all([getCourseLibrary(), getCurrentUser()]);
      await syncCourseCatalog(courses);
      if (user?.role !== "admin") {
        const statuses = await getCourseStatusMap(courses.map(item => item.id));
        const published = courses.filter(item => statuses.get(item.id) === "published");
        course = published.find(item => item.id === course?.id) ?? published[0] ?? null;
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
