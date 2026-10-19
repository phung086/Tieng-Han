import type { ImportJobStatus } from "@/lib/import-jobs";

export type McpReceipt = {
  id: string;
  at: string;
  method: string;
  tool?: string;
  jobId?: string;
  lessonId?: number;
  phase?: string;
  startPage?: number;
  endPage?: number;
  body: "parsed" | "omitted" | "none";
};

export type ImportMonitorSnapshot = {
  checkedAt: string;
  connection: {
    endpoint: string;
    eventName: string;
    protocol: string;
    auth: "bearer" | "development" | "blocked";
    subscriptions: number;
    matchingSubscriptions: number;
    nextRefreshBefore: string | null;
    error: string | null;
  };
  configuration: { automatic: boolean; autoRequeueMinutes: number; recording: boolean };
  jobs: Array<{ id: string; title: string; status: ImportJobStatus; createdAt: string }>;
  job: null | {
    id: string;
    title: string;
    status: ImportJobStatus;
    createdAt: string;
    updatedAt: string;
    uploadedPages: number;
    totalPages: number;
    files: string[];
    error: string | null;
    completed: Array<{
      lessonId: number; title: string; savedAt: string; questions: number;
      coverage?: number; grounding?: number; issues: string[];
    }>;
    work: Array<{
      lessonId: number; phase: string; savedAt: string;
      fileName?: string; pageNumber?: number; notes: string[]; partialQuestions: number;
    }>;
    candidateCount: number;
    bundleLessons: number | null;
  };
  receipts: McpReceipt[];
  recordingError: string | null;
};

export const importStatusLabel: Record<ImportJobStatus, string> = {
  uploading: "Đang tải nguồn", queued: "Đang chờ ChatGPT nhận job",
  processing: "Job đã được nhận", ready: "Bundle đã sẵn sàng",
  consumed: "Đã nhập vào Haneul", failed: "Biên dịch báo lỗi",
};

export const importPhaseLabel: Record<string, string> = {
  "source-reading": "Đọc giáo trình", drafting: "Soạn bài học", qa: "Kiểm tra nội dung",
};

export function importAlert(snapshot: ImportMonitorSnapshot, staleMinutes: number) {
  const job = snapshot.job;
  if (!job || job.status === "consumed" || job.status === "ready") return null;
  if (job.status === "failed") return job.error || "Plugin đã báo lỗi. Xem nguồn và nhật ký trước khi thử lại.";
  if (snapshot.connection.auth === "blocked") return "MCP bị chặn: bản production chưa cấu hình HANEUL_MCP_TOKEN.";
  if (snapshot.connection.error) return "Chưa đọc được cấu hình đăng ký sự kiện. Kiểm tra kết nối trước khi gửi lại job.";
  if (job.status === "queued" && snapshot.connection.matchingSubscriptions === 0) {
    return "Chưa có đăng ký sự kiện còn hạn khớp ngôn ngữ của job. ChatGPT chưa thể tự nhận job này.";
  }
  const savedAt = Math.max(Date.parse(job.updatedAt), ...job.work.map(w => Date.parse(w.savedAt)), ...job.completed.map(l => Date.parse(l.savedAt)));
  if (Date.parse(snapshot.checkedAt) - savedAt < staleMinutes * 60_000) return null;
  if (job.status === "queued") return "Job chờ lâu và hiện chưa được nhận. Có đăng ký sự kiện không đồng nghĩa ChatGPT đang chạy; kiểm tra cuộc trò chuyện Work và nhật ký bên dưới.";
  if (job.status === "processing") return "Lâu chưa có checkpoint hoặc bài học mới. Haneul chưa xác nhận được ChatGPT còn làm việc; xem lần liên hệ gần nhất và cuộc trò chuyện Work.";
  return "Nguồn chưa tải xong và lâu chưa cập nhật. Kiểm tra lại tệp và kết nối trình duyệt.";
}
