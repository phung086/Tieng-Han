import { NextResponse } from "next/server";
import {
  isSameOrigin,
  listCurrentUserSessions,
  recordAuditEvent,
  requireUser,
  revokeCurrentUserSession,
  revokeOtherUserSessions,
} from "@/lib/auth/server";
import { sessionActionSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      sessions: await listCurrentUserSessions(user.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc phiên đăng nhập.",
      },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const user = await requireUser();
    const parsed = sessionActionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Yêu cầu quản lý phiên không hợp lệ." },
        { status: 400 },
      );
    }

    if (parsed.data.action === "revokeOthers") {
      const revoked = await revokeOtherUserSessions(user.id);
      await recordAuditEvent({
        actorUserId: user.id,
        eventType: "auth.other_sessions_revoked",
        entityType: "user",
        entityId: user.id,
        metadata: { revoked },
      });
      return NextResponse.json({ ok: true, revoked });
    }

    const removed = await revokeCurrentUserSession(
      user.id,
      parsed.data.sessionId,
    );

    if (!removed) {
      return NextResponse.json(
        { error: "Không tìm thấy phiên đăng nhập." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "auth.session_revoked",
      entityType: "auth_session",
      entityId: parsed.data.sessionId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật phiên đăng nhập.",
      },
      { status: 401 },
    );
  }
}
