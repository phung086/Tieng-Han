import { NextResponse } from "next/server";
import {
  AuthError,
  createSession,
  isSameOrigin,
  recordAuditEvent,
  verifyUserCredentials,
} from "@/lib/auth/server";
import { loginSchema } from "@/lib/auth/validation";

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
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Thông tin đăng nhập không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const user = await verifyUserCredentials(
      parsed.data.email,
      parsed.data.password,
    );
    await createSession(user, request.headers.get("user-agent"));
    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "auth.logged_in",
      entityType: "user",
      entityId: user.id,
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status:
            error.code === "not_configured"
              ? 503
              : error.code === "disabled"
                ? 403
                : 401,
        },
      );
    }

    return NextResponse.json(
      { error: "Không thể đăng nhập lúc này." },
      { status: 500 },
    );
  }
}
