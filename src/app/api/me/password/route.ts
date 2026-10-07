import { NextResponse } from "next/server";
import {
  AuthError,
  changeCurrentUserPassword,
  isSameOrigin,
  recordAuditEvent,
  requireUser,
} from "@/lib/auth/server";
import { changePasswordSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Thông tin mật khẩu không hợp lệ.",
        },
        { status: 400 },
      );
    }

    await changeCurrentUserPassword({
      userId: user.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      revokeOtherSessions: parsed.data.revokeOtherSessions,
    });

    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "auth.password_changed",
      entityType: "user",
      entityId: user.id,
      metadata: {
        revokedOtherSessions: parsed.data.revokeOtherSessions,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "invalid_password" ? 400 : 401 },
      );
    }

    return NextResponse.json(
      { error: "Không thể đổi mật khẩu." },
      { status: 500 },
    );
  }
}
