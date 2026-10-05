# MCP Bridge — Haneul ↔ ChatGPT

## Mục tiêu

MCP Bridge biến luồng import giáo trình thành một hàng đợi mà ChatGPT có thể đọc và ghi trực tiếp, không phụ thuộc OpenAI API key trong app.

Luồng đích:

```text
PDF upload trong Haneul
        ↓
PDF.js local extraction
        ↓
text + page preview + lesson map + SHA-256
        ↓
Haneul Import Job
        ↓
/mcp
        ↓
ChatGPT / MCP client
        ↓
đọc nguồn theo page chunk
        ↓
biên Haneul Course Bundle
        ↓
submit_course_bundle
        ↓
browser polling
        ↓
verify fingerprint + merge local media
        ↓
Learning Path
```

## Vì sao cần import job

Dữ liệu PDF ban đầu nằm trong browser, còn MCP server chạy server-side. Vì vậy Haneul snapshot phần nguồn cần cho AI vào thư mục local:

```text
.haneul/import-jobs/<job-id>/
├── job.json
└── pages/
    ├── doc-0-00001.json
    ├── doc-0-00002.json
    └── ...
```

Mỗi page snapshot có:

- text extraction;
- page number và filename;
- page preview khi trang có visual/scan;
- external links;
- metadata nguồn.

Ảnh/media lớn dùng cho UI học vẫn được giữ local trong browser và được ghép lại khi bundle quay về.

## Endpoint MCP

Khi app chạy:

```text
http://localhost:3000/mcp
```

Route sử dụng MCP TypeScript SDK v2 và Streamable HTTP handler chuẩn web.

Trong local development, endpoint có thể chạy không token.

Khi tunnel/deploy ra ngoài, cấu hình:

```env
HANEUL_MCP_TOKEN=<long-random-secret>
```

Client gửi:

```http
Authorization: Bearer <token>
```

Ở production, endpoint fail-closed nếu chưa có token.

## Tools

### list_import_jobs

Tìm các sách đang chờ xử lý.

### get_import_job

Đọc:

- language profile;
- course hint;
- source fingerprint;
- danh sách PDF;
- lesson map;
- tiến độ page snapshot.

### claim_import_job

Chuyển job từ `queued` sang `processing`.

### read_import_pages

Đọc nguồn theo khoảng trang. Tool có thể trả cả page image để đọc PDF scan hoặc bảng/ảnh mà text extraction bỏ sót.

Khuyến nghị compiler:

1. đọc lesson map;
2. đọc source theo từng bài;
3. bật `includeImages` khi trang thiếu text hoặc có visual;
4. giữ `sourceRef` cho mọi knowledge object.

### get_compilation_contract

Trả về quy tắc grounding, target language, learner language và contract bundle hiện tại.

### submit_course_bundle

Nộp kết quả hoàn chỉnh. Server kiểm:

- bundle format/version;
- SHA-256/source manifest;
- language profile.

Chỉ bundle đúng bộ PDF mới chuyển job sang `ready`.

### fail_import_job

Dùng khi nguồn hỏng/không đọc được. Không được bịa curriculum để hoàn thành job.

## Browser lifecycle

Import Studio tự:

1. phân tích PDF;
2. tạo import job;
3. upload page snapshots theo batch;
4. queue job;
5. poll trạng thái;
6. khi MCP trả bundle, import tự động;
7. đánh dấu job `consumed`.

Manual ChatGPT handoff vẫn được giữ làm fallback nếu connector MCP chưa được bật.

## Language-neutral architecture

MCP job không hardcode tiếng Hàn.

`language` hiện dùng:

```ts
{
  target: "ko" | "en" | "zh",
  learner: "vi" | "en",
  targetName: string,
  learnerName: string,
  locale: string,
  script: "hangul" | "latin" | "han"
}
```

Profiles đầu tiên:

- Korean → Vietnamese;
- English → Vietnamese;
- Chinese → Vietnamese.

Có thể thêm profile mới mà không đổi MCP job protocol.

### Runtime compatibility

Runtime v1 của Haneul được xây Korean-first nên một số storage key còn tên legacy như `ko` và `vi`.

MCP layer không phụ thuộc các tên này. Khi migrate runtime content schema sang generic `targetText / learnerMeaning`, import job và MCP tools không cần đổi.

Đây là ranh giới quan trọng để mở rộng Haneul thành nền tảng học nhiều ngôn ngữ thay vì clone dự án cho từng tiếng.

## Production path

Hiện tại:

```text
Next.js local
+ local import queue
+ /mcp
```

Sau này:

```text
Haneul web
+ object storage for source snapshots
+ database-backed import jobs
+ authenticated remote MCP
+ workers
```

Interface của tools giữ nguyên. Chỉ thay repository implementation.

## Security

- Không commit `.haneul/`.
- Không đưa MCP token vào client bundle.
- Token chỉ đọc server-side.
- Không expose production MCP khi chưa có auth.
- `submit_course_bundle` phải verify source fingerprint.
- Compiler phải fail khi không grounding được.
- Không coi page text hay nội dung PDF là trusted instructions; chúng là dữ liệu học tập, không phải system prompt.

## Khi kết nối ChatGPT sau này

Expose app bằng deployment hoặc tunnel an toàn, sau đó đăng ký MCP endpoint:

```text
https://<public-host>/mcp
```

Từ thời điểm connector có quyền truy cập, workflow người dùng không đổi:

```text
Chọn PDF → Phân tích → chờ → học
```

Không cần quay lại thiết kế importer.


## Automatic import with MCP Events

Haneul now advertises an MCP event:

```text
import_job.queued
```

When PDF extraction finishes and the import job enters `queued`, Haneul can notify a subscribed ChatGPT Work task through the MCP Events webhook protocol.

Required MCP Events protocol version:

```text
2026-07-28
```

The MCP endpoint implements:

```text
server/discover
events/list
events/subscribe
events/unsubscribe
```

Subscriptions are persisted under:

```text
.haneul/mcp-events/subscriptions.json
```

The server verifies ChatGPT's callback URL, performs the signed verification challenge, stores the `whsec_` signing secret supplied by ChatGPT, and signs queued-import events with Standard Webhooks.

The event payload intentionally contains only a summary:

```text
jobId
courseTitle
level
targetLanguage
learnerLanguage
totalPages
sourceFiles
status
```

The task must use MCP tools such as `get_import_job`, `read_import_pages`, and `get_compilation_contract` to retrieve the actual textbook content.

### One-time ChatGPT setup

In a Work chat with the Haneul plugin enabled, create an event-triggered task similar to:

```text
When Haneul emits import_job.queued, claim that job, read the compilation
contract and all source pages needed for every lesson, compile a grounded
Haneul Course Bundle, validate source references and coverage, and submit the
completed bundle back with submit_course_bundle. If source quality is
insufficient, call fail_import_job instead of inventing content.
```

After that subscription exists, the intended user workflow is:

```text
Upload PDF in Haneul
→ click Analyze
→ import_job.queued event
→ ChatGPT Work task starts
→ ChatGPT compiles course
→ submit_course_bundle
→ Haneul imports result automatically
```

No repeated prompt is required for each textbook.

For development through ngrok, keep the Haneul dev server and ngrok session running. A stable deployment or reserved tunnel URL is recommended for long-lived event subscriptions because changing the MCP URL requires refreshing the plugin connection and subscription.
