import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isSameOrigin,
} from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getCourseAccess } from "@/lib/db/course-access";
import {
  getLearningState,
  saveLearningState,
} from "@/lib/db/learning-state-store";
import { saveLearningStateSchema } from "@/lib/db/learning-state-contract";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { configured: false, state: null },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập." },
      { status: 401 },
    );
  }

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (!courseId || courseId.length > 250) {
    return NextResponse.json(
      { error: "courseId không hợp lệ." },
      { status: 400 },
    );
  }

  const access = await getCourseAccess(user, courseId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Khóa học không khả dụng." },
      { status: access.exists ? 403 : 404 },
    );
  }

  return NextResponse.json({
    configured: true,
    ...(await getLearningState(user.id, courseId)),
  });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "PostgreSQL chưa được cấu hình." },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập." },
      { status: 401 },
    );
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 }); }
  const parsed = saveLearningStateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Learning state không hợp lệ.",
      },
      { status: 400 },
    );
  }

  const access = await getCourseAccess(user, parsed.data.courseId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Khóa học không khả dụng." },
      { status: access.exists ? 403 : 404 },
    );
  }

  if (parsed.data.expectedUserId && parsed.data.expectedUserId !== user.id) {
    return NextResponse.json({ error: "Tài khoản đã thay đổi. Vui lòng tải lại tiến độ.", code: "account_changed" }, { status: 409 });
  }

  const revision = await saveLearningState({
    userId: user.id,
    courseId: parsed.data.courseId,
    state: parsed.data.state,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
  });

  if (!revision) {
    return NextResponse.json({ error: "Tiến độ đã được cập nhật ở một phiên khác.", code: "progress_conflict" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, revision });
}
