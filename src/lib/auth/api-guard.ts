import { NextResponse } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";

export async function requireAdminApiAccess(
  request?: Request,
  options?: { mutation?: boolean },
): Promise<NextResponse | null> {
  if (options?.mutation && request && !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  // Local-first development keeps the existing no-database workflow.
  if (!isDatabaseConfigured()) return null;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Bạn cần đăng nhập bằng tài khoản admin." },
      { status: 401 },
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Tài khoản không có quyền quản trị nội dung." },
      { status: 403 },
    );
  }

  return null;
}
