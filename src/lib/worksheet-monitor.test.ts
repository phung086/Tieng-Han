import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WorksheetJobMonitor, type WorksheetSnapshot } from "@/components/worksheet-job-monitor";

const now = Date.now();
const snapshot: WorksheetSnapshot = { createdAt: now - 300_000, checkedAt: now, sourcePages: [], activity: [{ kind: "created", at: now - 300_000 }, { kind: "dispatch_accepted", at: now - 180_000, httpStatus: 200, attempt: 1 }] };
const render = (data: WorksheetSnapshot, ready = false) => renderToStaticMarkup(createElement(WorksheetJobMonitor, { snapshot: data, ready, rendering: false }));
it("distinguishes webhook receipt from reading, flags inactivity and exposes receipt time", () => {
  const html = render(snapshot);
  expect(html).toContain("OpenAI đã nhận sự kiện; chưa có cuộc gọi đọc đề.");
  expect(html).toContain("Chưa có cuộc gọi đọc đề sau hơn 2 phút.");
  expect(html).toContain("HTTP 200");
  expect(html).not.toContain("Đang chờ ChatGPT xử lý");
});
it("counts distinct image reads, reports missing pages and does not promise a PDF exists", () => {
  const data: WorksheetSnapshot = { ...snapshot, sourcePages: [1, 2], activity: [...snapshot.activity, { kind: "read", at: now, page: 1 }, { kind: "read", at: now, page: 1 }] };
  expect(render(data)).toContain("1/2 trang ảnh");
  expect(render(data)).toContain("Còn trang ảnh chưa được gọi đọc: 2");
  expect(render(data, true)).toContain("Kiểm tra file tải ở khung trang vở.");
  expect(render(data, true)).not.toContain("Chưa có hoạt động mới hơn");
});
it("shows legacy jobs without inventing historical delivery evidence", () => {
  expect(render({ ...snapshot, activity: [] })).toContain("Chưa có nhật ký giao sự kiện cho lượt này.");
});
