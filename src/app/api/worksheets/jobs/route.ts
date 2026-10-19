import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { worksheetRequestSchema } from "@/lib/worksheet-contract";
import { worksheetJobs } from "@/lib/worksheet-jobs";
import { readWorksheetBody, WorksheetBodyError } from "@/lib/worksheet-http";
import { worksheetEvents } from "@/lib/worksheet-events";
import { worksheetActivity } from "@/lib/worksheet-activity";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user && (isDatabaseConfigured() || process.env.NODE_ENV === "production")) return Response.json({ error: "Đăng nhập để gửi bài tập." }, { status: 401 });
  try {
    const body = await readWorksheetBody(request);
    const parsed = worksheetRequestSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Dữ liệu bài tập không hợp lệ." }, { status: 400 });
    const owner = user?.id ?? "local";
    const automatic = typeof body === "object" && body !== null && "automatic" in body && body.automatic === true;
    if (automatic && !(await worksheetEvents.status(owner)).configured) return Response.json({ error: "Kết nối ChatGPT một lần trước khi gửi tự động." }, { status: 409 });
    const job = await worksheetJobs.create(owner, parsed.data);
    await worksheetActivity.record(job.id, { kind: "created" });
    const status = await worksheetJobs.owned(job.id, owner);
    const dispatch = automatic ? await worksheetEvents.publish(owner, { jobId: job.id, accessKey: job.accessKey, sourceDigest: job.digest, expiresAt: new Date(status.expiresAt).toISOString() }) : { state: "unconfigured" };
    return Response.json({ ...job, dispatch }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof WorksheetBodyError ? error.message : "Chưa tạo được bài tập. Xóa bài cũ nếu đã có 12 bài đang lưu." }, { status: error instanceof WorksheetBodyError ? error.status : 400 });
  }
}
