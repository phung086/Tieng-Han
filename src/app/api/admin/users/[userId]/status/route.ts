import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSameOrigin,
  recordAuditEvent,
  requireAdmin,
} from "@/lib/auth/server";
import { setUserStatus } from "@/lib/db/course-catalog";

export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const admin = await requireAdmin();
    const { userId } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Trạng thái người dùng không hợp lệ." },
        { status: 400 },
      );
    }

    if (admin.id === userId && parsed.data.status === "disabled") {
      return NextResponse.json(
        { error: "Bạn không thể tự vô hiệu hóa tài khoản đang đăng nhập." },
        { status: 400 },
      );
    }

    const user = await setUserStatus(userId, parsed.data.status);
    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: admin.id,
      eventType: "user.status_changed",
      entityType: "user",
      entityId: userId,
      metadata: { status: parsed.data.status },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật trạng thái người dùng.",
      },
      { status: 403 },
    );
  }
}
