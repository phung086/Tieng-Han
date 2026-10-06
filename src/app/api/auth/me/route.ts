import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      configured: isDatabaseConfigured(),
      user: await getCurrentUser(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: isDatabaseConfigured(),
        user: null,
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc trạng thái đăng nhập.",
      },
      { status: 500 },
    );
  }
}
