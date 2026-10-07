import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { getMcpEventSetupStatus } from "@/lib/mcp-events";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await getMcpEventSetupStatus());
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        activeSubscriptions: 0,
        nextRefreshBefore: null,
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc trạng thái MCP automation.",
      },
      { status: 500 },
    );
  }
}
