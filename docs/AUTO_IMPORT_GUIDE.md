# Haneul — One-drop PDF import với ChatGPT

Mục tiêu vận hành của Haneul là:

```text
Chọn PDF
  ↓
Haneul tự đọc và chuẩn hóa nguồn
  ↓
import_job.queued
  ↓
Haneul Learning Bridge
  ↓
ChatGPT tự biên bài học + bài luyện
  ↓
Haneul xác minh nguồn và nhập khóa học
  ↓
Học + ôn theo lịch
```

Sau khi cấu hình một lần, người dùng không cần copy prompt, tải handoff, gọi từng MCP tool hay nhập lại metadata cho từng sách.

## 1. Cấu hình một lần

### 1.1 Chạy Haneul

```powershell
cd D:\Tieng-Han\Tieng-Han
git switch main
git pull
pnpm install
pnpm dev
```

Mở:

```text
http://localhost:3000/import
```

### 1.2 Dùng một URL MCP ổn định

ChatGPT cần truy cập được endpoint:

```text
https://<stable-host>/mcp
```

Đối với dự án cá nhân chạy tại máy, nên dùng tunnel có hostname cố định hoặc một host riêng. Tránh URL tunnel thay đổi mỗi lần chạy vì khi URL đổi phải reconnect plugin.

Development local có thể không cần token. Nếu public endpoint được dùng lâu dài, cấu hình:

```env
HANEUL_MCP_TOKEN=<long-random-secret>
```

Không cần `OPENAI_API_KEY` để dùng luồng ChatGPT plugin.

### 1.3 Kết nối Haneul Learning Bridge trong ChatGPT

Kết nối plugin một lần tới:

```text
https://<stable-host>/mcp
```

Sau khi server thay đổi tool lớn, refresh plugin một lần để ChatGPT đọc lại capabilities.

### 1.4 Tạo auto-compile subscription một lần

Trong ChatGPT Work dùng Haneul Learning Bridge, tạo event task cho:

```text
import_job.queued
```

Instruction tối giản:

```text
Khi Haneul phát import_job.queued, hãy biên import job đó đến khi hoàn tất.
Dùng Haneul Learning Bridge, gọi get_compilation_contract và tuân theo
workflow/checkpoint trong contract. Chỉ dùng nội dung có nguồn từ PDF,
không bịa nội dung, và finalize course khi tất cả bài thật đã hoàn thành.
```

Các quy tắc chi tiết về grounding, lesson structure, lượng bài luyện, checkpoint và QA đã nằm trong `get_compilation_contract`, vì vậy không cần lặp lại một prompt dài cho mỗi sách.

Subscription mặc định được tạo với thời hạn dài hơn và Haneul có endpoint trạng thái để giao diện biết auto-compile đã sẵn sàng hay chưa.

## 2. Quy trình dùng hằng ngày

Sau khi phần trên đã setup xong:

1. Mở Haneul.
2. Vào `/import`.
3. Chọn một hoặc nhiều PDF.
4. Chờ.
5. Mở giáo trình khi trạng thái hoàn tất.

Không còn nút bắt buộc "Phân tích cấu trúc sách".

Ngay khi chọn file, Haneul tự:

- trích text;
- tạo page preview;
- tính SHA-256;
- nhận diện lesson map khi có thể;
- dùng mặc định Tiếng Hàn → Tiếng Việt;
- tạo import job;
- upload page snapshots;
- queue job sang MCP;
- chờ ChatGPT compile;
- consume course bundle;
- reset progress cũ cho course mới;
- đưa course vào learning path.

Các trường ngôn ngữ, tên sách, cấp độ và edition nằm trong mục **Tùy chọn nâng cao** và chỉ cần sửa khi auto-detect không đúng.

## 3. ChatGPT sẽ biên như thế nào

ChatGPT lấy chính PDF làm source of truth.

Mỗi bài ưu tiên flow:

```text
Nhận diện kiến thức
→ hiểu từ vựng/ngữ pháp
→ luyện có kiểm soát
→ nghe/đọc theo ngữ cảnh
→ nói/viết chủ động
→ quiz
→ đưa điểm yếu vào lịch ôn
```

Policy trong compilation contract yêu cầu:

- giữ thứ tự bài của sách;
- giữ `sourceRef`;
- không thêm curriculum ngoài sách;
- bao phủ từ vựng, ngữ pháp, hội thoại, phát âm, văn hóa và phần đặc biệt khi nguồn có;
- tạo bài luyện 6 kỹ năng;
- khoảng 12–20 câu luyện cho một bài bình thường, tự điều chỉnh theo độ dày nội dung;
- không cố đủ số lượng nếu nguồn không hỗ trợ;
- distractor không được đưa kiến thức ngoài bài;
- lưu checkpoint khi sách dài;
- hoàn thành bài nào lưu draft bài đó để không phải biên lại từ đầu.

## 4. Ôn tập sau khi học

Haneul dùng mastery theo từng activity.

Lịch ôn mới giãn theo mức nhớ:

```text
Sai        → ôn lại hôm nay
Mới đúng   → +1 ngày
Ổn hơn     → +3 ngày
Khá chắc   → +7 ngày
Rất chắc   → +14 ngày
Thành thạo → +30 ngày
```

Sai câu nào thì strength giảm và nội dung quay lại hàng đợi sớm hơn.

Vì vậy user không cần tự tạo bộ ôn riêng sau khi import sách.

## 5. Trạng thái import

Luồng chuẩn:

```text
uploading
→ queued
→ processing
→ ready
→ consumed
```

Ý nghĩa:

- `uploading`: đang snapshot nguồn;
- `queued`: chờ ChatGPT nhận event;
- `processing`: ChatGPT đang biên;
- `ready`: course bundle hoàn thành;
- `consumed`: app đã nhập course;
- `failed`: có lỗi nguồn/compilation cần xử lý.

Nếu job `processing` không cập nhật trong thời gian cấu hình, Haneul tự requeue để task khác tiếp tục từ checkpoint.

## 6. Khả năng resume

Haneul lưu hai lớp checkpoint:

### Work checkpoint

Lưu giữa một bài:

- lessonId;
- phase;
- source cursor;
- notes;
- partial lesson;
- partial questions.

### Lesson draft

Lưu bài đã compile và QA xong.

Ví dụ ChatGPT dừng ở Bài 12:

```text
Bài 1–11 = hoàn tất
Bài 12   = đang dở ở source cursor gần nhất
```

Lần chạy tiếp theo chỉ tiếp tục Bài 12 trở đi.

## 7. Khi plugin chưa sẵn sàng

Trang Import hiển thị trạng thái của MCP event subscription.

Nếu thấy:

```text
Chưa bật auto-compile của ChatGPT
```

thì PDF vẫn có thể được chuẩn bị và queue, nhưng ChatGPT sẽ chưa tự nhận job.

Trong **Tùy chọn nâng cao**, Haneul vẫn giữ:

- xuất handoff;
- copy prompt;
- share PDF;
- import Course Bundle thủ công;
- direct API generation nếu máy có `OPENAI_API_KEY`.

Đây chỉ là fallback/debug, không phải workflow mặc định.

## 8. PDF scan

Nếu PDF có text layer yếu:

- Haneul dùng OCR local nếu API local được cấu hình;
- nếu không, page preview vẫn được lưu trong import job;
- ChatGPT có thể gọi `read_import_pages(includeImages=true)` để đọc trang scan/visual.

Vì vậy không bắt buộc phải cấu hình OpenAI API trong app chỉ để dùng plugin workflow.

## 9. Dữ liệu local

Không xóa:

```text
.haneul
```

nếu muốn giữ:

- import jobs;
- page snapshots;
- lesson drafts;
- work checkpoints;
- MCP event subscriptions.

Xóa `.next` khi cần làm sạch cache không ảnh hưởng checkpoint.

## 10. Mục tiêu UX cuối

Sau setup chuẩn, quy trình người dùng chỉ còn:

```text
Mở Haneul
→ chọn PDF
→ chờ
→ học
```

Mọi chi tiết MCP, checkpoint, grounding, QA và cấu trúc bài luyện nằm phía sau giao diện.
