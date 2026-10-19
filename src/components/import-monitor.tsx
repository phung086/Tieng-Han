"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, RefreshCw, Radio, Settings2 } from "lucide-react";
import { importAlert, importPhaseLabel, importStatusLabel, type ImportMonitorSnapshot, type McpReceipt } from "@/lib/import-monitor";
import { clientJson } from "@/lib/client-request";
import { importWorkflow } from "@/lib/workflow-state";
import { WorkflowRail } from "@/components/workflow-rail";

const tools: Record<string, string> = {
  list_import_jobs: "Tìm job đang chờ", prepare_import_job: "Chuẩn bị biên dịch",
  get_import_job: "Đọc thông tin job", claim_import_job: "Nhận job", requeue_import_job: "Đưa job về hàng chờ",
  read_import_pages: "Đọc trang giáo trình", get_compilation_progress: "Đọc tiến độ đã lưu",
  save_work_checkpoint: "Gửi checkpoint", save_lesson_draft: "Gửi bản nháp bài học",
  finalize_course_bundle: "Yêu cầu hoàn tất bundle", get_compilation_contract: "Đọc contract biên dịch",
  submit_course_bundle: "Gửi bundle", fail_import_job: "Báo lỗi biên dịch",
  "events/subscribe": "Đăng ký sự kiện", "events/unsubscribe": "Hủy đăng ký sự kiện",
  "server/discover": "Kiểm tra khả năng MCP", "tools/list": "Đọc danh sách công cụ",
  initialize: "Khởi tạo kết nối", "notifications/initialized": "Thông báo khởi tạo", ping: "Kiểm tra kết nối", "events/list": "Đọc danh sách sự kiện",
};
function date(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "Chưa ghi nhận";
}
function elapsed(value: string, now: string) {
  const minutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(value)) / 60_000));
  return minutes < 1 ? "vừa cập nhật" : minutes < 60 ? `${minutes} phút trước` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút trước`;
}
function receiptDetail(receipt: McpReceipt) {
  return [receipt.lessonId ? `Bài ${receipt.lessonId}` : "", receipt.phase ? importPhaseLabel[receipt.phase] : "", receipt.startPage ? `Trang ${receipt.startPage}${receipt.endPage ? `–${receipt.endPage}` : ""}` : "", !receipt.jobId ? "Kết nối chung / chưa gắn job" : ""].filter(Boolean).join(" · ");
}

type Props = {
  jobId: string;
  onConnectionUpdate: (connection: { configured: boolean; activeSubscriptions: number; nextRefreshBefore: string | null }) => void;
};

export function ImportMonitor({ jobId, onConnectionUpdate }: Props) {
  const [choice, setChoice] = useState({ parent: "", id: "" });
  const selected = choice.parent === jobId ? choice.id || jobId : jobId;
  const [snapshot, setSnapshot] = useState<ImportMonitorSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pollSeconds, setPollSeconds] = useState(5);
  const [staleMinutes, setStaleMinutes] = useState(5);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const prefs = JSON.parse(localStorage.getItem("haneul-import-monitor") || "{}");
        if ([5, 10, 30].includes(prefs.pollSeconds)) setPollSeconds(prefs.pollSeconds);
        if ([5, 10, 20].includes(prefs.staleMinutes)) setStaleMinutes(prefs.staleMinutes);
      } catch { /* Storage can be unavailable in private browsing. */ }
    });
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      setBusy(true);
      try {
        const data = await clientJson<ImportMonitorSnapshot>("/api/import-monitor" + (selected ? `?jobId=${encodeURIComponent(selected)}` : ""), { signal: controller.signal });
        if (stopped) return;
        setSnapshot(data);
        setError("");
        if (!jobId || data.job?.id === jobId) onConnectionUpdate({ configured: data.connection.matchingSubscriptions > 0 && data.connection.auth !== "blocked" && !data.connection.error, activeSubscriptions: data.connection.subscriptions, nextRefreshBefore: data.connection.nextRefreshBefore });
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : "Mất kết nối khi đọc tiến độ.");
      } finally {
        if (!stopped) {
          setBusy(false);
          timer = setTimeout(() => void poll(), (document.hidden ? Math.max(30, pollSeconds) : pollSeconds) * 1000);
        }
      }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [selected, jobId, pollSeconds, refresh, onConnectionUpdate]);

  function prefs(poll: number, stale: number) {
    setPollSeconds(poll); setStaleMinutes(stale);
    try { localStorage.setItem("haneul-import-monitor", JSON.stringify({ pollSeconds: poll, staleMinutes: stale })); } catch { /* Keep preferences for this page session. */ }
  }
  const current = snapshot && (!selected || snapshot.job?.id === selected) ? snapshot : null;
  const job = current?.job;
  const alert = current ? importAlert(current, staleMinutes) : null;
  const contact = current?.receipts.find(r => r.jobId === job?.id);
  const workflow = current ? importWorkflow(current, staleMinutes) : null;

  async function copySetup() {
    try {
      const resume = job && ["queued", "processing"].includes(job.status) ? ` Kiểm tra và tiếp tục job ${job.id} (${job.title}); đọc get_compilation_progress trước để dùng lại phần đã lưu, không tạo job mới và không mở worker trùng.` : "";
      await navigator.clipboard.writeText(`Trong ChatGPT Work, dùng Haneul Learning Bridge (${current?.connection.endpoint || "/mcp"}). Kiểm tra server/discover và events/list, đăng ký import_job.queued cho mọi giáo trình và duy trì đăng ký.${resume} Khi nhận sự kiện, gọi prepare_import_job(jobId) rồi tuân thủ contract/checkpoint trả về cho đến finalize_course_bundle. Lưu checkpoint và bài học trong quá trình làm để Haneul theo dõi được. Đọc page image khi text không đủ; không bịa nội dung. Kiểm tra cả job đang queued bằng list_import_jobs để tiếp tục các job tồn tại trước khi đăng ký; chỉ tiếp tục một worker cho mỗi job. Nếu có lỗi nguồn thực sự, gọi fail_import_job.`);
      setNotice("Đã sao chép hướng dẫn kết nối. Dán một lần vào cuộc trò chuyện Work có bật Haneul Learning Bridge.");
    } catch { setNotice("Trình duyệt chưa cho sao chép. Xem các bước kết nối bên dưới."); }
  }

  return <section className="import-monitor" aria-labelledby="import-monitor-title">
    <header className="import-monitor-header">
      <div><h2 id="import-monitor-title"><Radio size={22} /> Theo dõi biên dịch</h2><p>Tiến độ lấy từ job, checkpoint và bài học đã lưu trên Haneul.</p></div>
      <button type="button" className="secondary-button" onClick={() => setRefresh(n => n + 1)} disabled={busy}><RefreshCw size={16} className={busy ? "spin" : ""} /> Làm mới</button>
    </header>
    <div className="import-monitor-controls">
      <label>Giáo trình đang theo dõi<select value={selected || snapshot?.job?.id || ""} onChange={e => setChoice({ parent: jobId, id: e.target.value })}>
        {!snapshot?.jobs.length ? <option value="">Chưa có job</option> : snapshot.jobs.map(j => <option key={j.id} value={j.id}>{j.title || j.id} · {importStatusLabel[j.status]}</option>)}
      </select></label>
      <span className="import-monitor-check">{current ? `Đã kiểm tra ${date(current.checkedAt)}` : "Đang đọc trạng thái…"}<small>Tự cập nhật mỗi {pollSeconds} giây khi mở trang</small></span>
    </div>
    {error ? <div className="import-monitor-alert" role="alert"><AlertTriangle size={18} /><div><strong>Chưa cập nhật được trạng thái</strong><p>{error} Dữ liệu cũ, nếu có, được giữ lại; bảng sẽ tự thử lại.</p></div></div> : null}
    {alert ? <div className="import-monitor-alert"><AlertTriangle size={18} /><div><strong>{job?.status === "failed" ? "Cần xử lý lỗi" : "Cần kiểm tra hoạt động"}</strong><p>{alert}</p><p>{job?.status === "queued" ? "Mở cuộc trò chuyện Work có bật plugin và yêu cầu tiếp tục job này. Đăng ký sự kiện không tự chứng minh rằng job cũ đã được đọc." : "Không có cập nhật chưa đủ để kết luận job đã hỏng. Kiểm tra trước khi gửi lại để tránh hai worker cùng làm."}</p></div></div> : null}
    {job && current ? <>
      {workflow && <WorkflowRail state={workflow} checkedAt={Date.parse(current.checkedAt)} />}
      <div className="import-monitor-state"><strong className={`import-monitor-badge ${job.status}`}>{importStatusLabel[job.status]}</strong><code>{job.id}</code></div>
      <dl className="import-monitor-facts">
        <div><dt>Nguồn đã tải</dt><dd>{job.uploadedPages}/{job.totalPages} trang</dd></div>
        <div><dt>Bài học đã lưu</dt><dd>{job.completed.length} bài · {job.completed.reduce((n, l) => n + l.questions, 0)} câu luyện</dd></div>
        <div><dt>Dữ liệu job cập nhật</dt><dd>{elapsed(job.updatedAt, current.checkedAt)}<small>{date(job.updatedAt)}</small></dd></div>
        <div><dt>Yêu cầu MCP gần nhất của job</dt><dd>{contact ? elapsed(contact.at, current.checkedAt) : "Chưa ghi nhận"}<small>{contact ? tools[contact.tool || contact.method] || contact.method : "Nhật ký chỉ ghi từ khi bật theo dõi"}</small></dd></div>
      </dl>
      <p className="import-monitor-note">{job.files.join(" · ")}</p>
      <p className="import-monitor-note">{job.bundleLessons !== null ? `Bundle chứa ${job.bundleLessons} bài.` : `Phát hiện ${job.candidateCount} mốc bài gợi ý; chưa xác nhận tổng số bài nên chưa có phần trăm biên dịch.`}</p>
      <div className="import-monitor-work">
        <h3>Checkpoint và kết quả đã lưu</h3>
        {job.work.length ? job.work.map(w => <article key={w.lessonId}><strong>Bài {w.lessonId} · {importPhaseLabel[w.phase] || w.phase}</strong><span>{w.fileName || "Nguồn chưa được ghi trong checkpoint"}{w.pageNumber ? ` · trang ${w.pageNumber}` : ""} · {date(w.savedAt)}</span>{w.notes.map((n, i) => <p key={i}>{n}</p>)}<small>{w.partialQuestions} câu đang ở bản nháp</small></article>) : <p>{job.completed.length ? "Không có checkpoint dở dang. Xem các bài đã lưu bên dưới." : job.bundleLessons !== null ? "Bundle đã được lưu. Bài gửi trực tiếp trong bundle có thể không có bản nháp riêng." : "Chưa có checkpoint hoặc bài học được lưu. Haneul chưa có bằng chứng về nội dung đã biên dịch."}</p>}
        {job.completed.length ? <details><summary>{job.completed.length} bài học đã lưu</summary><ul className="import-monitor-lessons">{job.completed.map(l => <li key={l.lessonId}><CheckCircle2 size={16} /><div><strong>Bài {l.lessonId}: {l.title}</strong><span>{l.questions} câu · {date(l.savedAt)}{l.coverage !== undefined ? ` · Bao phủ ${l.coverage}` : ""}{l.grounding !== undefined ? ` · Bám nguồn ${l.grounding}` : ""}</span>{l.issues.length ? <p>{l.issues.join(" · ")}</p> : null}</div></li>)}</ul></details> : null}
      </div>
    </> : !error && current ? <p>Chưa có job. Chọn PDF để bắt đầu; bảng sẽ theo dõi nguồn và hoạt động biên dịch.</p> : null}
    <div className="import-monitor-log">
      <h3>Nhật ký yêu cầu tới MCP</h3>
      <p className="import-monitor-note">Yêu cầu đã đến Haneul chưa đồng nghĩa công cụ chạy thành công. Checkpoint và bài học phía trên là kết quả được xác nhận. Haneul không thấy phần xử lý nội bộ của ChatGPT hoặc lịch sử gọi trước khi bật nhật ký.</p>
      {current?.recordingError ? <p role="alert">{current.recordingError}</p> : null}
      {current && !current.configuration.recording ? <p>Nhật ký đang tắt bởi HANEUL_IMPORT_MONITOR_DISABLED.</p> : null}
      {current?.receipts.length ? <div className="import-monitor-table-wrap"><table><caption className="sr-only">Tối đa 50 yêu cầu MCP gần nhất của job và kết nối chung</caption><thead><tr><th scope="col">Thời gian (Việt Nam)</th><th scope="col">Yêu cầu đã nhận</th><th scope="col">Thông tin</th></tr></thead><tbody>{current.receipts.slice(0, 50).map(r => <tr key={r.id}><td>{date(r.at)}</td><td><strong>{tools[r.tool || r.method] || r.method}</strong><code>{r.tool || r.method}</code></td><td>{r.body === "omitted" ? "Không đọc nội dung: quá lớn, chậm hoặc không phải JSON. Handler vẫn nhận yêu cầu gốc." : receiptDetail(r) || "Yêu cầu gắn với job đang xem"}</td></tr>)}</tbody></table></div> : <p>{current ? "Chưa ghi nhận yêu cầu MCP. Nếu job vẫn chờ, chưa thể khẳng định ChatGPT đã nhận nó." : "Đang đọc nhật ký của job được chọn…"}</p>}
    </div>
    <details className="import-monitor-settings"><summary><Settings2 size={18} /> Cấu hình kết nối và theo dõi</summary>
      <div className="import-monitor-settings-body">
        <dl className="import-monitor-config">
          <div><dt>Plugin giáo trình</dt><dd>Haneul Learning Bridge</dd></div>
          <div><dt>URL MCP</dt><dd><code>{current?.connection.endpoint || "/mcp"}</code>{current?.connection.endpoint === "/mcp" ? <small>Thêm HANEUL_MCP_PUBLIC_URL=https://tên-miền-public vào .env.local để hiển thị URL ChatGPT có thể truy cập.</small> : null}</dd></div>
          <div><dt>Đăng ký sự kiện</dt><dd>{current?.connection.matchingSubscriptions ?? "…"} khớp job / {current?.connection.subscriptions ?? "…"} còn hạn<small>Đăng ký không chứng minh callback đã giao thành công hoặc ChatGPT đang chạy.</small></dd></div>
          <div><dt>Sự kiện / protocol</dt><dd><code>{current?.connection.eventName || "import_job.queued"} · {current?.connection.protocol || "…"}</code></dd></div>
          <div><dt>Hạn gia hạn gần nhất</dt><dd>{date(current?.connection.nextRefreshBefore)}</dd></div>
          <div><dt>Xác thực MCP</dt><dd>{!current ? "Đang đọc cấu hình…" : current.connection.auth === "bearer" ? "Bearer token đã cấu hình (ẩn giá trị)" : current.connection.auth === "blocked" ? "Bị chặn: thiếu token trên production" : "Chế độ development không yêu cầu token"}</dd></div>
          <div><dt>Luồng nhập hiện tại</dt><dd>{!current ? "Đang đọc cấu hình…" : current.configuration.automatic ? "Bắt đầu khi chọn PDF" : "Tự bắt đầu đang tắt"}<small>Luồng hiện có đưa job processing về hàng chờ sau {current?.configuration.autoRequeueMinutes ?? 20} phút không cập nhật. Thiết lập cảnh báo bên dưới chỉ điều khiển bảng theo dõi.</small></dd></div>
        </dl>
        <div className="import-monitor-prefs"><label>Chu kỳ đọc trạng thái<select value={pollSeconds} onChange={e => prefs(Number(e.target.value), staleMinutes)}><option value={5}>5 giây</option><option value={10}>10 giây</option><option value={30}>30 giây</option></select></label><label>Cảnh báo không có tiến độ sau<select value={staleMinutes} onChange={e => prefs(pollSeconds, Number(e.target.value))}><option value={5}>5 phút</option><option value={10}>10 phút</option><option value={20}>20 phút</option></select></label></div>
        <p>Các lựa chọn này được nhớ trên trình duyệt. Lời nhắc cảnh báo không hủy, gửi lại hoặc khởi động job.</p>
        <ol><li>Mở ChatGPT Work và bật Haneul Learning Bridge trong cuộc trò chuyện chạy tác vụ.</li><li>Dùng URL MCP ở trên; duy trì đăng ký sự kiện import_job.queued. Không dùng plugin vở bài tập cho giáo trình.</li><li>Kiểm tra các job đang chờ, tiếp tục job theo contract và lưu checkpoint. Xem nhật ký ở đây để xác nhận yêu cầu đã tới Haneul.</li></ol>
        <button className="secondary-button" type="button" disabled={!current} onClick={() => void copySetup()}><Copy size={16} /> Sao chép hướng dẫn kết nối</button>
        <p className="import-monitor-note">Nếu đổi miền public hoặc máy chủ ngừng chạy, cập nhật URL kết nối trong ChatGPT. Bảng này chưa kiểm chứng việc giao callback hoặc mạng public từ phía ChatGPT.</p>
        <p role="status">{notice}</p>
      </div>
    </details>
  </section>;
}
