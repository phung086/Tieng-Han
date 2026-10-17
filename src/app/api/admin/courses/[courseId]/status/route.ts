import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSameOrigin,
  recordAuditEvent,
  requireAdmin,
} from "@/lib/auth/server";
import { setCourseStatus } from "@/lib/db/course-catalog";
import { getCourseLibrary } from "@/lib/course-consumer";

export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(["draft", "published", "archived"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const admin = await requireAdmin();
    const { courseId } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Trạng thái giáo trình không hợp lệ." },
        { status: 400 },
      );
    }

    if (parsed.data.status === "published") {
      const candidate = (await getCourseLibrary()).find(course => course.id === courseId);
      if (!candidate) return NextResponse.json({ error: "Không tìm thấy giáo trình." }, { status: 404 });
      if (candidate.source?.curriculumCoverage?.status !== "complete") {
        return NextResponse.json({ error: "Chưa thể xuất bản: cần đối chiếu đủ trang, nội dung, bài luyện và xác minh inventory nguồn." }, { status: 409 });
      }
    }
    const course = await setCourseStatus(
      courseId,
      parsed.data.status,
    );

    if (!course) {
      return NextResponse.json(
        { error: "Không tìm thấy giáo trình." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: admin.id,
      eventType: "course.status_changed",
      entityType: "course",
      entityId: courseId,
      metadata: { status: parsed.data.status },
    });

    return NextResponse.json({
      course: {
        id: course.course_id,
        status: course.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật giáo trình.",
      },
      { status: 403 },
    );
  }
}
