import type { ImportMonitorSnapshot } from "@/lib/import-monitor";
import type { WorksheetActivity } from "@/lib/worksheet-activity";

export type WorkflowStep = { label: string; detail: string; state: "done" | "current" | "waiting" | "blocked" };
export type WorkflowState = { title: string; note: string; tone: "normal" | "warning" | "error" | "success"; lastActivity: number; steps: WorkflowStep[] };
export type WorksheetEvidence = { activity: WorksheetActivity[]; createdAt: number; checkedAt: number; sourcePages: number[] };

export function worksheetWorkflow(evidence: WorksheetEvidence, ready: boolean, fileReady: boolean, building: boolean, connectionError = ""): WorkflowState {
  fileReady = ready && fileReady;
  const recent = [...evidence.activity].reverse();
  const dispatch = recent.find(e => e.kind.startsWith("dispatch_"));
  const read = recent.find(e => e.kind === "read");
  const rejected = recent.find(e => e.kind === "result_rejected");
  const lastActivity = Math.max(evidence.createdAt, ...evidence.activity.map(e => e.at));
  const stale = !ready && evidence.checkedAt - lastActivity > 120_000;
  const invalid = !ready && Boolean(rejected && rejected.at >= (read?.at ?? 0));
  const deliveryBlocked = !read && (dispatch?.kind === "dispatch_failed" || dispatch?.kind === "dispatch_unconfigured");
  const readPages = new Set(evidence.activity.filter(e => e.kind === "read" && e.page).map(e => e.page));
  const allPagesRead = Boolean(read) && evidence.sourcePages.every(page => readPages.has(page));
  const labels = ["Lưu đề", "Giao sự kiện", "Đọc đề", "Nhận đáp án", "Dựng vở"];
  const complete = [true, Boolean(read) || dispatch?.kind === "dispatch_accepted", ready || allPagesRead, ready, fileReady];
  const current = invalid ? 3 : complete.findIndex(value => !value);
  let title = fileReady ? "Vở đã sẵn sàng để tải" : ready ? building ? "Đang dựng trang vở và PDF" : "Đã nhận đáp án; chưa có file tải" : read ? allPagesRead ? "Đã đọc đề; đang chờ đáp án gửi về" : "Đang đọc đề; chưa xác nhận đủ trang ảnh" : dispatch?.kind === "dispatch_accepted" ? "Đã giao sự kiện; chờ ChatGPT đọc đề" : "Chờ giao đề tới ChatGPT";
  let note = ready ? "Bạn có thể kiểm tra và chỉnh sửa nội dung trước khi tải." : "Haneul chỉ xác nhận hoạt động khi công cụ đọc đề hoặc lưu kết quả được gọi.";
  if (invalid) { title = "Dừng ở bước nhận đáp án"; note = "Kết quả chưa hợp lệ. Công cụ cần sửa và gửi lại; dữ liệu nguồn vẫn được giữ."; }
  if (deliveryBlocked) { title = "Chưa giao được sự kiện"; note = dispatch?.kind === "dispatch_unconfigured" ? "Kiểm tra đăng ký plugin còn hạn ở phần Kết nối ChatGPT." : "Kiểm tra kết nối và gửi lại đề một lần; không tạo thêm bài trùng."; }
  if (stale && !invalid && !deliveryBlocked) note = read ? "Hơn 2 phút chưa có hoạt động mới. Kiểm tra lượt chạy Work: hạn mức, quyền công cụ hoặc lỗi xử lý. Haneul chưa thể xác nhận tác vụ còn chạy." : "Hơn 2 phút chưa có cuộc gọi đọc đề. Kiểm tra hạn mức Work, trạng thái tác vụ và tunnel. HTTP 200 chưa xác nhận tác vụ đã chạy.";
  if (connectionError) { title = "Mất kết nối với bảng theo dõi"; note = connectionError + " Chưa thể kết luận tác vụ ChatGPT đã dừng."; }
  return { title, note, lastActivity, tone: connectionError || deliveryBlocked || invalid ? "error" : stale || (ready && !fileReady && !building) ? "warning" : fileReady ? "success" : "normal",
    steps: labels.map((label, index) => ({ label, state: complete[index] ? "done" : index === current ? (deliveryBlocked || invalid ? "blocked" : "current") : "waiting", detail: index === 2 && evidence.sourcePages.length ? `${readPages.size}/${evidence.sourcePages.length} trang ảnh đã gọi đọc` : complete[index] ? "Đã xác nhận" : index === current ? "Chưa xác nhận hoàn tất" : "Chưa đến bước này" })) };
}

export function importWorkflow(snapshot: ImportMonitorSnapshot, staleMinutes = 5): WorkflowState | null {
  const job = snapshot.job;
  if (!job) return null;
  const received = snapshot.receipts.filter(r => r.jobId === job.id);
  const saved = Math.max(Date.parse(job.updatedAt), ...job.work.map(w => Date.parse(w.savedAt)), ...job.completed.map(l => Date.parse(l.savedAt)));
  const lastActivity = Math.max(saved, ...received.map(r => Date.parse(r.at)));
  const done = job.status === "consumed";
  const compiled = done || job.status === "ready";
  const working = compiled || job.status === "processing";
  const source = job.totalPages > 0 && job.uploadedPages === job.totalPages;
  const blocked = job.status === "failed" || snapshot.connection.auth === "blocked" || Boolean(snapshot.connection.error) || (job.status === "queued" && !snapshot.connection.matchingSubscriptions);
  const stale = !compiled && Date.parse(snapshot.checkedAt) - saved > staleMinutes * 60_000;
  const flags = [source, compiled, compiled, done];
  const first = flags.findIndex(BooleanValue => !BooleanValue);
  const labels = ["Lưu nguồn", "Nhận & biên dịch", "Xác minh bundle", "Nhập giáo trình"];
  const title = done ? "Giáo trình đã sẵn sàng để học" : compiled ? "Bundle đã sẵn sàng; chờ nhập" : job.status === "failed" ? "Biên dịch đã báo lỗi" : working ? "Đã nhận job; chờ checkpoint và bài học" : source ? "Đã lưu nguồn; chờ ChatGPT nhận job" : "Đang lưu các trang nguồn";
  return { title, lastActivity, tone: blocked ? "error" : stale ? "warning" : done ? "success" : "normal",
    note: job.status === "failed" ? job.error || "Xem lỗi và checkpoint đã lưu trước khi tiếp tục."
      : blocked ? "Kiểm tra cấu hình kết nối bên dưới. Nguồn và phần đã lưu được giữ lại."
      : stale ? `Hơn ${staleMinutes} phút chưa có tiến độ được lưu. Kiểm tra lượt chạy Work, hạn mức và tunnel trước khi tiếp tục job; tránh chạy hai worker.`
      : `${job.completed.length} bài học và ${job.work.length} checkpoint đã lưu. Không ước lượng phần trăm khi chưa xác nhận tổng số bài.`,
    steps: labels.map((label, index) => ({ label, state: flags[index] ? "done" : first === index ? blocked ? "blocked" : "current" : "waiting", detail: index === 0 ? `${job.uploadedPages}/${job.totalPages} trang` : index === 1 ? `${job.completed.length} bài đã lưu` : flags[index] ? "Đã xác nhận" : "Chưa xác nhận" })) };
}
