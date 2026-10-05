import { NextResponse } from "next/server";
import { getMcpEventSetupStatus } from "@/lib/mcp-events";

export const runtime = "nodejs";

export async function GET() {
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
