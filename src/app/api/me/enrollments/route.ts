import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isSameOrigin,
} from "@/lib/auth/server";
import { dbQuery, isDatabaseConfigured } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const enrollmentSchema = z.object({
  courseId: z.string().min(1).max(250),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập." },
      { status: 401 },
    );
  }

  const parsed = enrollmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "courseId không hợp lệ." },
      { status: 400 },
    );
  }

  await dbQuery(
    `
      INSERT INTO haneul_course_enrollments
        (user_id, course_id, enrolled_at, last_opened_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET last_opened_at = NOW()
    `,
    [user.id, parsed.data.courseId],
  );

  return NextResponse.json({ ok: true });
}
