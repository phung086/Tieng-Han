import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { getAdminImportJobs } from "@/lib/admin/import-monitor";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  try {
    return NextResponse.json({
      jobs: await getAdminImportJobs(20),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc trạng thái import.",
      },
      { status: 500 },
    );
  }
}
