"use client";

import { useEffect, useState } from "react";
import type { WorksheetActivity } from "@/lib/worksheet-activity";
import { WorkflowRail } from "@/components/workflow-rail";
import { worksheetWorkflow } from "@/lib/workflow-state";

export type WorksheetSnapshot = { activity: WorksheetActivity[]; createdAt: number; sourcePages: number[]; checkedAt: number };
const time = (at: number) => new Date(at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
function describe(event: WorksheetActivity) {
  switch (event.kind) {
    case "created": return "Đã lưu đề riêng trên Haneul";
    case "dispatch_accepted": return `OpenAI đã nhận sự kiện (HTTP ${event.httpStatus})`;
    case "dispatch_failed": return `Gửi sự kiện thất bại${event.httpStatus ? ` (HTTP ${event.httpStatus})` : " do lỗi kết nối"} · lần ${event.attempt}`;
    case "dispatch_unconfigured": return "Chưa có đăng ký nhận sự kiện còn hạn";
    case "read": return event.page ? `Công cụ đã đọc trang ảnh ${event.page}` : "Công cụ đã đọc đề / danh sách trang";
    case "submitted": return `Đã lưu ${event.count} câu trả lời đã kiểm tra cấu trúc và nguồn`;
    case "result_rejected": return "Kết quả gửi về chưa hợp lệ; công cụ cần sửa và gửi lại";
  }
}

export function WorksheetJobMonitor({ snapshot, ready, rendering, fileReady = false, connectionError = "" }: { snapshot: WorksheetSnapshot | null; ready: boolean; rendering: boolean; fileReady?: boolean; connectionError?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  if (!snapshot) return <p role={connectionError ? "alert" : "status"}>{connectionError || "Đang kiểm tra hoạt động của bài tập…"}</p>;
  const { activity, createdAt, sourcePages } = snapshot;
  const checkedAt = Math.max(snapshot.checkedAt, now);
  const latest = [...activity].reverse();
  const dispatch = latest.find((event) => event.kind.startsWith("dispatch_"));
  const read = latest.find((event) => event.kind === "read");
  const rejected = latest.find((event) => event.kind === "result_rejected");
  const readPages = new Set(activity.filter((event) => event.kind === "read" && event.page).map((event) => event.page));
  const stalled = !ready && checkedAt - (read?.at ?? dispatch?.at ?? createdAt) > 120_000;
  const missingPages = sourcePages.filter((page) => !readPages.has(page));
  const headline = ready ? rendering ? "Đã nhận đáp án; đang dựng file vở." : "Đã nhận đáp án. Kiểm tra file tải ở khung trang vở."
    : rejected && rejected.at >= (read?.at ?? 0) ? "Kết quả chưa hợp lệ; đang chờ công cụ sửa lại."
    : read ? "Đã có cuộc gọi đọc đề; chưa nhận kết quả."
    : dispatch?.kind === "dispatch_accepted" ? "OpenAI đã nhận sự kiện; chưa có cuộc gọi đọc đề."
    : dispatch?.kind === "dispatch_failed" ? "Đã lưu đề; gửi sự kiện thất bại."
    : dispatch?.kind === "dispatch_unconfigured" ? "Đã lưu đề; đăng ký nhận sự kiện chưa hoạt động."
    : "Đề đang chờ. Chưa có nhật ký giao sự kiện cho lượt này.";
  return <section className="worksheet-monitor" aria-label="Hoạt động xử lý bài tập">
    <WorkflowRail state={worksheetWorkflow({ ...snapshot, checkedAt }, ready, fileReady, rendering, connectionError)} checkedAt={checkedAt} />
    <p className="worksheet-monitor-status" role="status">{headline}</p>
    <ol className="worksheet-monitor-stages">
      <li data-done="true"><strong>Lưu đề</strong><span>{time(createdAt)}</span></li>
      <li data-done={dispatch?.kind === "dispatch_accepted"}><strong>Giao sự kiện</strong><span>{dispatch ? time(dispatch.at) : "Chưa có dữ liệu"}</span></li>
      <li data-done={Boolean(read)}><strong>Đọc đề</strong><span>{read ? sourcePages.length ? `${readPages.size}/${sourcePages.length} trang ảnh` : time(read.at) : "Chưa gọi công cụ"}</span></li>
      <li data-done={ready}><strong>Lưu đáp án</strong><span>{ready ? "Đã nhận" : "Chưa nhận"}</span></li>
    </ol>
    {stalled && <p className="worksheet-warning">{read ? "Chưa có hoạt động mới hơn 2 phút. Kiểm tra lượt chạy ChatGPT xem đang chờ quyền, báo lỗi hay dừng giữa chừng." : "Chưa có cuộc gọi đọc đề sau hơn 2 phút. Mở tác vụ Work/Cloud đã đăng ký để kiểm tra trạng thái chạy, lịch gộp sự kiện và yêu cầu cấp quyền công cụ. Không cần dán lại lệnh cho từng bài."}</p>}
    {!ready && read && missingPages.length > 0 && <p>Còn trang ảnh chưa được gọi đọc: {missingPages.join(", ")}. Chưa thể xác nhận công cụ đã xem đủ đề.</p>}
    <details><summary>Nhật ký hoạt động · kiểm tra thành công lúc {time(snapshot.checkedAt)}</summary>
      <p>Haneul không đọc được hạn mức hoặc lỗi nội bộ của ChatGPT. Khi không có cuộc gọi mới, kiểm tra hạn mức Work, quyền công cụ và tình trạng tunnel trong lượt chạy đã đăng ký.</p>
      <p>HTTP 2xx chỉ xác nhận nhận sự kiện. Haneul ghi lại các cuộc gọi đọc/lưu; chưa thể quan sát suy luận nội bộ của ChatGPT.</p>
      <p>Nếu ChatGPT báo 403 về quyền MCP, kiểm tra quyền của workspace và plugin Haneul Vở bài tập trong chính tác vụ nhận sự kiện. Tạo được gói plugin hoặc đăng ký webhook chưa xác nhận tác vụ có quyền gọi công cụ đọc/lưu.</p>
      {activity.length ? <ol className="worksheet-monitor-log">{[...activity].reverse().map((event, index) => <li key={`${event.at}-${index}`}><time dateTime={new Date(event.at).toISOString()}>{time(event.at)}</time><span>{describe(event)}</span></li>)}</ol> : <p>Lượt này được tạo trước khi có nhật ký. Bấm Gửi lại đề để ghi nhận lần giao tiếp theo.</p>}
    </details>
  </section>;
}
