import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { worksheetJobs } from "@/lib/worksheet-jobs";
import { worksheetActivity } from "@/lib/worksheet-activity";

export const runtime = "nodejs";
async function handle(request: Request, context: { params: Promise<{ id: string }> }, remove = false) {
  if (remove && !isSameOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user && (isDatabaseConfigured() || process.env.NODE_ENV === "production")) return Response.json({ error: "Cần đăng nhập." }, { status: 401 });
  try {
    const { id } = await context.params;
    const result = remove ? await worksheetJobs.remove(id, user?.id ?? "local") : await worksheetJobs.owned(id, user?.id ?? "local");
    if (remove) { await worksheetActivity.remove(id); return Response.json({ removed: true }); }
    return Response.json({ ...result, activity: await worksheetActivity.list(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Bài tập không tồn tại, đã bị xóa hoặc hết hạn." }, { status: 404 }); }
}
export const GET = handle;
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return handle(request, context, true); }
