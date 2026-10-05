# Haneul - Quy trình nhập sách tự động

Tài liệu vận hành cuối cùng cho luồng:
PDF trong Haneul -> MCP -> ChatGPT Work -> checkpoint -> Course Bundle -> Haneul.

## 1. Mục tiêu

Sau khi cấu hình một lần, mỗi lần nhập sách bạn chỉ cần:

1. Mở Haneul.
2. Chọn ngôn ngữ đích.
3. Chọn PDF.
4. Bấm Phân tích cấu trúc sách.
5. Chờ Haneul và ChatGPT hoàn tất.

Không cần gửi PDF lại trong chat. Không cần tự chạy từng MCP tool. Không cần biên lại các bài đã hoàn thành khi phiên AI bị gián đoạn.

## 2. Kiến trúc hiện tại

Haneul xử lý PDF tại máy:

- trích text;
- tạo page preview;
- lập lesson map;
- tính SHA-256;
- tạo import job.

Khi job chuyển sang queued, Haneul phát event:

`import_job.queued`

ChatGPT Work nhận event và xử lý theo checkpoint:

`get_compilation_progress`
-> đọc phần nguồn chưa hoàn thành
-> `save_work_checkpoint`
-> biên và QA bài
-> `save_lesson_draft`
-> lặp với bài tiếp theo
-> `finalize_course_bundle`

Haneul nhận kết quả, kiểm fingerprint nguồn, ghép media local và lưu khóa học.

## 3. Các MCP tool quan trọng

- `list_import_jobs`: xem hàng đợi.
- `get_import_job`: xem metadata và source manifest.
- `claim_import_job`: chuyển queued sang processing.
- `requeue_import_job`: đưa job bị gián đoạn trở lại queued.
- `read_import_pages`: đọc trang nguồn bằng fileName hoặc documentId.
- `get_compilation_progress`: xem lesson đã xong và work checkpoint đang dở.
- `save_work_checkpoint`: lưu tiến độ giữa bài.
- `save_lesson_draft`: lưu bài đã biên và QA xong.
- `get_compilation_contract`: đọc quy tắc grounding và schema.
- `finalize_course_bundle`: ghép các lesson draft thành course hoàn chỉnh.
- `submit_course_bundle`: tương thích với workflow cũ.
- `fail_import_job`: đánh dấu lỗi nguồn thật sự.

## 4. Cấu hình một lần trên máy

### 4.1 Đồng bộ mã nguồn

Mở PowerShell:

```powershell
cd D:\Tieng-Han\Tieng-Han
git switch main
git pull
pnpm install
```

Chạy kiểm tra:

```powershell
pnpm typecheck
```

Nếu Next.js còn cache cũ:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

### 4.2 Chạy Haneul

```powershell
pnpm dev
```

Mở:

`http://localhost:3000/import`

Giữ terminal này chạy trong thời gian import.

### 4.3 Chạy HTTPS tunnel trong giai đoạn development

Mở PowerShell thứ hai:

```powershell
ngrok http 3000
```

Lấy URL HTTPS mà ngrok cung cấp, sau đó thêm `/mcp`.

Ví dụ:

`https://your-domain.ngrok-free.dev/mcp`

Nếu domain ngrok thay đổi, cập nhật URL server của Haneul Learning Bridge trong ChatGPT.

## 5. Cấu hình Haneul Learning Bridge trong ChatGPT

Plugin cần trỏ tới:

`https://your-domain.ngrok-free.dev/mcp`

Trong môi trường development hiện tại:

- Transport: Streamable HTTP.
- Authentication: Không xác thực.
- Chỉ dùng URL tunnel mà bạn kiểm soát.
- Không công khai URL tunnel.

Sau khi server MCP thay đổi tool hoặc event, refresh/reconnect plugin để ChatGPT quét lại capability.

## 6. Cấu hình tự động bằng ChatGPT Work

Tạo một Work chat dùng Haneul Learning Bridge.

Thiết lập một lần instruction theo ý sau:

Khi Haneul phát event `import_job.queued`:

1. Lấy đúng `jobId` từ event.
2. Gọi `get_import_job`.
3. Gọi `get_compilation_contract`.
4. Gọi `get_compilation_progress`.
5. Nếu job queued thì claim.
6. Nếu có `activeWork`, tiếp tục đúng phase và sourceCursor.
7. Bỏ qua mọi `completedLessonIds`.
8. Đọc source theo từng chunk.
9. Sau mỗi chunk quan trọng, gọi `save_work_checkpoint`.
10. Sau khi một bài hoàn chỉnh và QA đạt, gọi `save_lesson_draft`.
11. Lặp tới hết các bài thật của giáo trình.
12. Không tin tuyệt đối lesson detector; bỏ false-positive nếu source không xác nhận.
13. Khi mọi bài thật đã có draft, gọi `finalize_course_bundle`.
14. Nếu nguồn hỏng thật sự, gọi `fail_import_job`, không bịa nội dung.

Quy tắc nội dung:

- Giáo trình là source of truth.
- Không thêm curriculum ngoài nguồn.
- Mỗi knowledge item phải có sourceRef.
- Derived practice chỉ dùng kiến thức trong đúng bài nguồn.
- Bao phủ từ vựng, ngữ pháp, hội thoại, phát âm, văn hóa, ghi chú và phần đặc biệt nếu sách có.
- Tạo flow Từ vựng, Ngữ pháp, Nghe, Nói, Đọc, Viết và quiz.
- Dùng language profile của job, không giả định tiếng Hàn.

## 7. Quy trình nhập sách hằng ngày

### Bước 1 - Mở dịch vụ

Đảm bảo hai terminal đang chạy:

`pnpm dev`

và:

`ngrok http 3000`

### Bước 2 - Mở Import Studio

`http://localhost:3000/import`

### Bước 3 - Chọn ngôn ngữ đích

Nhập mã ngôn ngữ.

Ví dụ:

- `ko`: tiếng Hàn
- `en`: tiếng Anh
- `zh`: tiếng Trung
- `ja`: tiếng Nhật
- ngôn ngữ mới: dùng mã phù hợp

Kiến trúc không khóa target language vào ko/en/zh.

### Bước 4 - Chọn PDF

Thứ tự khuyến nghị:

1. Giáo trình chính.
2. Workbook.
3. Sách luyện dịch.
4. Tài liệu ngữ pháp hoặc tài liệu bổ sung.

Không trộn nhiều cấp độ không liên quan vào cùng một import job.

### Bước 5 - Phân tích

Bấm:

`Phân tích cấu trúc sách`

Haneul sẽ tự tạo import job và queue sang MCP.

### Bước 6 - Chờ tự động

Trạng thái chuẩn:

`uploading -> queued -> processing -> ready -> consumed`

Ý nghĩa:

- uploading: đang lưu page snapshot.
- queued: đã sẵn sàng cho ChatGPT.
- processing: ChatGPT đang xử lý.
- ready: course bundle đã hoàn tất.
- consumed: Haneul đã nhập course vào app.
- failed: có lỗi nguồn hoặc compilation thật sự.

### Bước 7 - Mở khóa học

Sau khi consumed:

- vào Giáo trình;
- kiểm tra Bài 1;
- kiểm tra một bài giữa;
- kiểm tra bài cuối;
- xác nhận sourceRef và nội dung 6 kỹ năng.

## 8. Cơ chế không phải làm lại từ đầu

Haneul có hai tầng checkpoint.

### Work checkpoint giữa bài

`save_work_checkpoint` lưu:

- lessonId;
- phase;
- source cursor;
- notes;
- partial lesson;
- partial questions.

Nếu phiên AI dừng giữa Bài 12 ở trang 187, phiên sau có thể tiếp tục từ checkpoint đó.

### Lesson draft

`save_lesson_draft` lưu bài đã hoàn thành.

Ví dụ:

- Bài 1-11 đã lưu.
- Bài 12 đang dở.
- ChatGPT bị ngắt.

Lần chạy sau:

- Bài 1-11 bị bỏ qua.
- Bài 12 tiếp tục từ work checkpoint.
- Không biên lại từ Bài 1.

## 9. Tự khôi phục job bị kẹt

Nếu job ở `processing` nhưng không cập nhật quá 20 phút khi trang Import vẫn mở, Haneul tự đưa job về `queued` và phát lại event.

Mỗi work checkpoint hoặc lesson draft cập nhật thời gian hoạt động, vì vậy task đang chạy bình thường sẽ không bị requeue nếu checkpoint đều đặn.

Fallback thủ công:

`requeue_import_job`

Sau requeue, checkpoint cũ vẫn còn và được dùng để resume.

## 10. Không được xóa khi muốn tiếp tục

Không xóa thư mục:

`.haneul`

nếu bạn muốn giữ:

- import jobs;
- page snapshots;
- lesson drafts;
- work checkpoints;
- MCP event subscriptions.

Chỉ xóa `.next` khi cần làm sạch cache Next.js.

## 11. Khi nào cần reset hoàn toàn

Chỉ reset nếu muốn bỏ toàn bộ dữ liệu import cũ.

Dừng app, sau đó:

```powershell
Remove-Item -Recurse -Force .haneul
```

Sau đó trong Chrome:

DevTools -> Application -> Storage -> Clear site data.

Lưu ý: thao tác này xóa checkpoint và subscription local.

## 12. Mở rộng sang ngôn ngữ khác

LanguageProfile hiện dùng:

- target
- learner
- targetName
- learnerName
- locale
- script

Content canonical fields:

- targetTitle
- learnerTitle
- targetText
- learnerMeaning

Các alias cũ như ko/vi vẫn được normalize để UI hiện tại tiếp tục hoạt động.

Vì vậy khi thêm ngôn ngữ mới, không cần tạo MCP server mới và không cần thay checkpoint protocol.

## 13. Kiểm tra MCP khi có lỗi

Chỉ dùng MCP Inspector khi debug.

Local:

`http://localhost:3000/mcp`

Remote:

`https://your-domain.ngrok-free.dev/mcp`

Nguyên tắc debug:

1. Local hỏng -> xem terminal `pnpm dev`.
2. Local tốt, remote hỏng -> kiểm tra ngrok.
3. Local và remote tốt, ChatGPT không thấy tool mới -> reconnect plugin.
4. Job processing bị ngắt -> xem `get_compilation_progress`, sau đó requeue nếu cần.

## 14. Cập nhật project sau này

Quy trình an toàn:

```powershell
cd D:\Tieng-Han\Tieng-Han
git switch main
git pull
pnpm install
pnpm typecheck
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm dev
```

Không xóa `.haneul` trong quá trình update thông thường.

## 15. Checklist ngắn trước khi nhập sách

- Haneul đang chạy.
- Tunnel đang chạy.
- Haneul Learning Bridge đang connected.
- Work automation đã subscribe event.
- Đúng ngôn ngữ đích.
- PDF giáo trình chính đứng đầu.
- Không xóa `.haneul`.

Sau đó chỉ cần:

Chọn PDF -> Phân tích cấu trúc sách -> Chờ -> Học.

## 16. Ghi chú production

Ngrok no-auth phù hợp cho development.

Khi dùng lâu dài nên chuyển sang endpoint/tunnel ổn định và có authentication phù hợp. Việc đổi transport không làm thay đổi:

- import job protocol;
- checkpoint protocol;
- language profile;
- course bundle;
- learning UI.
