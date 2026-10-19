import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { worksheetEvents } from "@/lib/worksheet-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  if (request.method !== "GET" && !isSameOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user && (isDatabaseConfigured() || process.env.NODE_ENV === "production")) return Response.json({ error: "Đăng nhập để kết nối ChatGPT." }, { status: 401 });
  const owner = user?.id ?? "local";
  try {
    if (request.method === "DELETE") { await worksheetEvents.revoke(owner); return Response.json({ configured: false }, { headers: { "Cache-Control": "no-store" } }); }
    const channel = request.method === "POST" ? await worksheetEvents.channel(owner) : null;
    const status = await worksheetEvents.status(owner);
    const base = process.env.HANEUL_WORKSHEET_PUBLIC_URL;
    const endpoint = base && /^https:\/\//.test(base) ? new URL("/worksheet-mcp", base).href : new URL("/worksheet-mcp", request.url).href;
    return Response.json({ ...status, endpoint, ...(channel ? { channelKey: channel.key } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Chưa đọc được kết nối. Thử lại sau." }, { status: 503 }); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
