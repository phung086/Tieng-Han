import { NextResponse } from "next/server";
import { getActiveCourse } from "@/lib/course-consumer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const course = await getActiveCourse();
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
