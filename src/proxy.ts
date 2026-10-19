import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { recordMcpRequest } from "@/lib/import-monitor-log";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  // Observation only. No auth/headers/body rewrites, retries or compiler calls.
  event.waitUntil(recordMcpRequest(request).catch(() => {
    console.warn("Haneul: chưa ghi được nhật ký yêu cầu MCP.");
  }));
  return NextResponse.next();
}

export const config = { matcher: "/mcp" };
