import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { listImportJobs, getCompilationProgress } from "@/lib/import-job-store";
import { HANEUL_IMPORT_QUEUED_EVENT, MCP_EVENTS_PROTOCOL_VERSION } from "@/lib/mcp-events";
import { readMcpReceipts } from "@/lib/import-monitor-log";
import { ingestionConfig } from "@/config/ingestion";
import type { ImportMonitorSnapshot } from "@/lib/import-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function endpoint() {
  try {
    const url = new URL(process.env.HANEUL_MCP_PUBLIC_URL || process.env.HANEUL_WORKSHEET_PUBLIC_URL || "");
    if (url.protocol !== "https:" || url.username || url.password) return "/mcp";
    return url.origin + "/mcp";
  } catch { return "/mcp"; }
}

async function subscriptions(targetLanguage?: string) {
  type Subscription = { name: string; arguments?: { targetLanguage?: string }; refreshBefore?: string | null };
  let stored: Subscription[] = [];
  let error: string | null = null;
  try {
    const file = path.join(process.env.HANEUL_EVENT_DIR || path.join(process.cwd(), ".haneul", "mcp-events"), "subscriptions.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(data.subscriptions)) throw new Error("invalid store");
    stored = data.subscriptions;
  } catch (reason) {
    if ((reason as NodeJS.ErrnoException).code !== "ENOENT") error = "Không đọc được cấu hình sự kiện.";
  }
  const active = stored.filter(s => s.name === HANEUL_IMPORT_QUEUED_EVENT && (!s.refreshBefore || Date.parse(s.refreshBefore) > Date.now()));
  const matching = active.filter(s => !s.arguments?.targetLanguage || !targetLanguage || s.arguments.targetLanguage === targetLanguage);
  return { subscriptions: active.length, matchingSubscriptions: matching.length, nextRefreshBefore: matching.map(s => s.refreshBefore).filter((v): v is string => Boolean(v)).sort()[0] ?? null, error };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user && (isDatabaseConfigured() || process.env.NODE_ENV === "production")) return Response.json({ error: "Đăng nhập để xem hoạt động biên dịch." }, { status: 401, headers });
    if (user && user.role !== "admin") return Response.json({ error: "Chỉ quản trị viên được xem hoạt động biên dịch." }, { status: 403, headers });
    const requested = new URL(request.url).searchParams.get("jobId");
    if (requested && !/^import-[a-z0-9-]{8,72}$/i.test(requested)) return Response.json({ error: "Job ID không hợp lệ." }, { status: 400, headers });
    const jobs = await listImportJobs();
    const job = requested ? jobs.find(j => j.id === requested) : jobs[0];
    if (requested && !job) return Response.json({ error: "Job không còn tồn tại. Chọn một job khác." }, { status: 404, headers });
    const progress = job ? await getCompilationProgress(job.id) : null;
    let recordingError: string | null = null;
    const receipts = await readMcpReceipts(job?.id).catch(() => {
      recordingError = "Chưa đọc được nhật ký MCP. Kiểm tra quyền ghi thư mục theo dõi.";
      return [];
    });
    const snapshot: ImportMonitorSnapshot = {
      checkedAt: new Date().toISOString(),
      connection: {
        endpoint: endpoint(), eventName: HANEUL_IMPORT_QUEUED_EVENT, protocol: MCP_EVENTS_PROTOCOL_VERSION,
        auth: process.env.HANEUL_MCP_TOKEN?.trim() ? "bearer" : process.env.NODE_ENV === "production" ? "blocked" : "development",
        ...await subscriptions(job?.language.target),
      },
      configuration: { automatic: ingestionConfig.autoImport.enabled, autoRequeueMinutes: ingestionConfig.autoImport.staleJobMinutes, recording: process.env.HANEUL_IMPORT_MONITOR_DISABLED !== "1" },
      jobs: jobs.slice(0, 60).map(j => ({ id: j.id, title: j.courseHint.title, status: j.status, createdAt: j.createdAt })),
      job: job && progress ? {
        id: job.id, title: job.courseHint.title, status: progress.status, createdAt: job.createdAt, updatedAt: job.updatedAt,
        uploadedPages: job.uploadedPages, totalPages: job.totalPages, files: job.documents.map(d => d.fileName), error: job.error ?? null,
        completed: progress.completedLessons.map(l => ({ lessonId: l.lessonId, title: l.learnerTitle || l.title, savedAt: l.savedAt, questions: l.questionCount, coverage: l.coverageScore, grounding: l.groundingScore, issues: l.issues })),
        work: progress.activeWork.map(w => ({ lessonId: w.lessonId, phase: w.phase, savedAt: w.savedAt, fileName: w.sourceCursor?.fileName, pageNumber: w.sourceCursor?.pageNumber, notes: w.notes.slice(-3).map(n => n.slice(0, 1000)), partialQuestions: w.partialQuestions?.length ?? 0 })),
        candidateCount: new Set(progress.detectedCandidates.map(c => c.lessonId)).size,
        bundleLessons: job.resultBundle?.course.lessons.length ?? null,
      } : null,
      receipts, recordingError,
    };
    return Response.json(snapshot, { headers });
  } catch {
    return Response.json({ error: "Chưa đọc được tiến độ. Kiểm tra PostgreSQL và thư mục lưu job; thử làm mới." }, { status: 503, headers });
  }
}
