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


### requeue_import_job

Đưa một job đang `processing` hoặc `failed` trở lại `queued` khi phiên ChatGPT bị gián đoạn. Tool này phát lại event `import_job.queued` để workflow tự động có thể nhận job lần nữa. Job `ready` hoặc `consumed` không được requeue.

### read_import_pages

Đọc nguồn theo khoảng trang. Tool có thể trả cả page image để đọc PDF scan hoặc bảng/ảnh mà text extraction bỏ sót.

Khuyến nghị compiler:

1. đọc lesson map;
2. đọc source theo từng bài;
3. bật `includeImages` khi trang thiếu text hoặc có visual;
4. giữ `sourceRef` cho mọi knowledge object.

### get_compilation_progress

Đọc checkpoint biên soạn theo từng bài. ChatGPT phải gọi tool này trước khi đọc source trong mọi phiên mới hoặc phiên resume để bỏ qua các bài đã hoàn thành.

### save_work_checkpoint

Lưu checkpoint giữa bài theo phase `source-reading`, `drafting` hoặc `qa`. Checkpoint có thể chứa source cursor, notes và partial lesson/question state. Dùng tool này sau các chunk đọc nguồn quan trọng để nếu phiên bị ngắt thì tiếp tục đúng trang gần nhất thay vì đọc lại từ đầu bài.

### save_lesson_draft

Lưu một bài đã biên và QA xong thành checkpoint bền vững. Gọi lại cùng lessonId sẽ chỉ ghi đè bài đó, không ảnh hưởng các bài khác. Khi lesson draft được lưu, mid-lesson work checkpoint của bài đó được xóa tự động.

Checkpoint nằm trong:

```text
.haneul/import-jobs/<job-id>/drafts/
```

### get_compilation_contract

Trả về quy tắc grounding, language profile, schema và workflow checkpoint hiện tại.

### finalize_course_bundle

Ghép các lesson draft đã lưu thành Course Bundle cuối cùng ở server. Có thể truyền danh sách lessonIds đã xác minh để loại bỏ lesson detector false-positive. Sau khi finalize, job chuyển sang `ready`.

### submit_course_bundle

Giữ lại để tương thích với client cũ. Workflow mới nên ưu tiên `save_lesson_draft` + `finalize_course_bundle`.

Khi dùng trực tiếp, server kiểm:

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


## Resumable compilation

Compiler không còn cần giữ toàn bộ course trong một phiên ChatGPT.

Workflow chuẩn:

```text
get_compilation_progress
        ↓
nếu activeWork có dữ liệu → resume đúng phase/sourceCursor
        ↓
đọc một chunk source chưa xong
        ↓
save_work_checkpoint
        ↓
tiếp tục đọc / draft / QA
        ↓
save_lesson_draft
        ↓
lặp lại với bài tiếp theo
        ↓
finalize_course_bundle
```

Nếu ChatGPT bị ngắt ở giữa Bài 12:

```text
Bài 1-11 = lesson draft đã lưu
Bài 12   = work checkpoint, ví dụ source cursor p.187
```

Phiên sau gọi `get_compilation_progress`, bỏ qua Bài 1-11 và tiếp tục Bài 12 từ checkpoint gần nhất. Không cần đọc lại từ đầu khóa hoặc từ đầu bài.

Nếu cần sửa riêng Bài 5, gọi `save_lesson_draft` lại với lessonId 5. Chỉ checkpoint Bài 5 được thay thế.

## Language-neutral content contract

MCP protocol không còn giới hạn target language ở ko/en/zh. `LanguageProfile.target` và `learner` nhận language code dạng chuỗi; locale và script đi kèm profile.

Canonical content fields mới:

```text
targetTitle
learnerTitle
targetText
learnerMeaning
```

Các field legacy `title/vi`, `vocabulary.ko/vi`, `dialogue.ko/vi` vẫn được normalize tự động để UI cũ tiếp tục chạy.

Vì vậy có thể thêm ngôn ngữ mới bằng LanguageProfile mà không đổi MCP job protocol, event protocol hay checkpoint workflow.


## Automatic stale-job recovery

Browser Import Studio theo dõi job đang `processing`. Nếu job không được cập nhật quá 20 phút, Haneul coi phiên AI đã bị gián đoạn, tự gọi requeue và phát lại `import_job.queued`.

Mỗi `save_work_checkpoint` hoặc `save_lesson_draft` cập nhật `updatedAt`, vì vậy một compiler đang hoạt động và checkpoint đều đặn sẽ không bị requeue nhầm.

Đây là lớp recovery bổ sung cho trường hợp Work chat/tunnel bị ngắt trong lúc biên sách dài.
