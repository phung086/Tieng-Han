import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSameOrigin,
  recordAuditEvent,
  requireAdmin,
} from "@/lib/auth/server";
import { setUserRole } from "@/lib/db/course-catalog";

export const runtime = "nodejs";

const roleSchema = z.object({
  role: z.enum(["learner", "admin"]),
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
    const parsed = roleSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Vai trò không hợp lệ." },
        { status: 400 },
      );
    }

    const user = await setUserRole(userId, parsed.data.role);
    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: admin.id,
      eventType: "user.role_changed",
      entityType: "user",
      entityId: userId,
      metadata: { role: parsed.data.role },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật vai trò.",
      },
      { status: 403 },
    );
  }
}
