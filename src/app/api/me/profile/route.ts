import { NextResponse } from "next/server";
import {
  isSameOrigin,
  recordAuditEvent,
  requireUser,
  updateCurrentUserProfile,
} from "@/lib/auth/server";
import { updateProfileSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const current = await requireUser();
    const parsed = updateProfileSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Thông tin hồ sơ không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const user = await updateCurrentUserProfile(current.id, parsed.data);
    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản đang hoạt động." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: current.id,
      eventType: "user.profile_updated",
      entityType: "user",
      entityId: current.id,
      metadata: { nameChanged: current.name !== user.name },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật hồ sơ.",
      },
      { status: 401 },
    );
  }
}
