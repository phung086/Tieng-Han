import { NextResponse } from "next/server";
import {
  destroyCurrentSession,
  getCurrentUser,
  isSameOrigin,
  recordAuditEvent,
} from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  await destroyCurrentSession();

  if (user) {
    await recordAuditEvent({
      actorUserId: user.id,
      eventType: "auth.logged_out",
      entityType: "user",
      entityId: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
