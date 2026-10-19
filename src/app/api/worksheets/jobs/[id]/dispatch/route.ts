import { z } from "zod";
import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { readWorksheetBody } from "@/lib/worksheet-http";
import { worksheetJobs } from "@/lib/worksheet-jobs";
import { worksheetEvents } from "@/lib/worksheet-events";

export const runtime = "nodejs";
const running = new Set<string>();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user && (isDatabaseConfigured() || process.env.NODE_ENV === "production")) return Response.json({ error: "Cần đăng nhập." }, { status: 401 });
  const owner = user?.id ?? "local";
  let locked = "";
  try {
    const { id } = await context.params;
    const { accessKey } = z.object({ accessKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(await readWorksheetBody(request, 1000));
    const status = await worksheetJobs.owned(id, owner);
    if (status.status === "ready") return Response.json({ state: "ready" });
    const source = await worksheetJobs.read(id, accessKey);
    if (running.has(id)) return Response.json({ error: "Đang gửi bài này. Chờ một lát." }, { status: 409 });
    running.add(id); locked = id;
    return Response.json(await worksheetEvents.publish(owner, { jobId: id, accessKey, sourceDigest: source.digest, expiresAt: new Date(status.expiresAt).toISOString() }), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Không gửi được bài. Kiểm tra kết nối hoặc tạo lượt mới nếu bài đã hết hạn." }, { status: 400 }); }
  finally { if (locked) running.delete(locked); }
}
