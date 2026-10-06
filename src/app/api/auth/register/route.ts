import { NextResponse } from "next/server";
import {
  AuthError,
  createSession,
  createUser,
  isSameOrigin,
  recordAuditEvent,
} from "@/lib/auth/server";
import { registerSchema } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Thông tin đăng ký không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const user = await createUser(parsed.data);
    await createSession(user, request.headers.get("user-agent"));
    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "auth.registered",
      entityType: "user",
      entityId: user.id,
      metadata: { role: user.role },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status:
            error.code === "email_taken"
              ? 409
              : error.code === "not_configured"
                ? 503
                : 400,
        },
      );
    }

    return NextResponse.json(
      { error: "Không thể tạo tài khoản lúc này." },
      { status: 500 },
    );
  }
}
