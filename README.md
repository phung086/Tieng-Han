# Haneul — Tiếng Hàn

Ứng dụng cá nhân để học và ôn luyện tiếng Hàn bám sát giáo trình: **Từ vựng · Ngữ pháp · Nghe · Nói · Đọc · Viết**.

## Mục tiêu sản phẩm

Haneul được xây theo hướng **local-first** và **textbook-first**:

1. Chạy app local.
2. Upload PDF giáo trình, workbook hoặc tài liệu bổ sung.
3. Haneul tự đọc cấu trúc sách, tách bài và tạo dữ liệu học tập.
4. Nội dung được kiểm định lại với trang nguồn trước khi nhập.
5. Giáo trình mới xuất hiện ngay trong Dashboard/Learning Path.
6. Bắt đầu học, làm quiz, review và theo dõi tiến độ.

Không cần sửa component hoặc viết code riêng cho từng cuốn sách.

## Chạy local

Yêu cầu Node.js 22+.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

API key là **tùy chọn**. Nếu chưa có key, cứ chạy app bình thường và dùng luồng **ChatGPT-assisted** ở trang Import. Khi muốn bật chế độ tự động qua API, điền:

```env
OPENAI_API_KEY=...
OPENAI_CONTENT_MODEL=gpt-6-luna
OPENAI_OCR_MODEL=
```

Mở http://localhost:3000.

Kiểm tra toàn bộ project:

```bash
pnpm check
```

## Import giáo trình từ PDF

Mở:

```text
http://localhost:3000/import
```

Hoặc vào **Cài đặt → Nhập giáo trình từ PDF**.

Có thể chọn nhiều file:

```text
01. Giáo trình chính.pdf
02. Sách bài tập.pdf
03. Tài liệu bổ sung.pdf
```

PDF đầu tiên được dùng để xác định lộ trình bài học.

Có hai pipeline dùng chung một content contract.

### Không cần API key

```text
PDF trong Haneul
 ↓
Local PDF.js extraction
 ↓
Text / images / cover / links
 ↓
SHA-256 handoff package
 ↓
Share/upload PDF + handoff to ChatGPT
 ↓
ChatGPT compiles Haneul Course Bundle
 ↓
Haneul verifies PDF fingerprint
 ↓
Merge bundle + local textbook media
 ↓
IndexedDB
 ↓
Learning Path
```

### Có API key

```text
PDF
 ↓
PDF.js text extraction
 ↓
Vision OCR fallback cho trang scan
 ↓
Nhận diện metadata sách
 ↓
Lesson map / bỏ qua mục lục
 ↓
Chia dữ liệu theo từng bài
 ↓
AI content compiler
 ↓
Vocabulary / Grammar
Listening / Speaking
Reading / Writing
Dialogue / Pronunciation
Culture / Extra sections
Quiz bank
 ↓
Source grounding validation
 ↓
Tự sửa 1 lần nếu chưa đạt
 ↓
IndexedDB
 ↓
Learning Path
```

### Nguyên tắc grounding

Importer không được dùng AI để viết một giáo trình mới.

- Từ vựng và ngữ pháp phải dựa trên trang nguồn.
- Hội thoại, phát âm, văn hóa và các mục đặc biệt được giữ lại nếu sách có.
- Mọi object quan trọng có `sourceRef` về file/trang nguồn.
- Bài tập mới có thể được tạo để luyện tập nhưng kiến thức/đáp án phải suy ra từ nội dung sách.
- Nếu sách không có section Đọc/Viết riêng, hệ thống có thể tạo **practice derived** chỉ từ từ vựng/ngữ pháp/hội thoại/câu ví dụ trong bài.
- Nội dung Nghe không được tự tạo curriculum mới; khi chưa có audio, app có thể dùng TTS cho các câu lấy từ nguồn.
- Mỗi lesson được AI QA lại về **coverage** và **grounding**.
- Nếu sau tự sửa mà bài vẫn dưới ngưỡng chất lượng, import dừng thay vì âm thầm đưa dữ liệu kém vào app.

## PDF scan

Nếu PDF không có text layer và có AI API key, Haneul tự:

```text
PDF page
→ Canvas render
→ Vision OCR
→ Korean/Vietnamese text
→ normal ingestion pipeline
```

OCR chỉ chạy cho các trang thiếu text để giảm chi phí và thời gian.

Nếu chưa có API key, Haneul vẫn giữ preview ảnh của các trang scan. Khi dùng ChatGPT-assisted, ChatGPT đọc trực tiếp PDF bạn tải vào cuộc trò chuyện và bundle được ghép lại với media local theo `sourceRef`/lesson map.

## Dữ liệu local

- **Learning progress:** localStorage.
- **Imported textbook/course:** IndexedDB.
- PDF gốc không được commit vào repository.
- API key chỉ được đọc server-side từ `.env.local`.

Nếu IndexedDB bị chặn bởi browser mode, app có fallback storage khi có thể.

## Chức năng học hiện có

- Dashboard cá nhân.
- Learning path theo giáo trình.
- Lesson workspace.
- Từ vựng: flashcard, Korean TTS, nhớ/chưa nhớ.
- Ngữ pháp & quiz: choice, input, reorder, giải thích tức thời.
- Nghe: TTS/audio-ready player, tốc độ chậm, câu hỏi nghe hiểu.
- Nói: shadowing + browser SpeechRecognition.
- Đọc: passage, bản dịch hỗ trợ, câu hỏi đọc hiểu.
- Viết: editor, local rubric.
- Hội thoại, phát âm, văn hóa, extra textbook sections.
- Smart review dùng mastery cho cả 6 kỹ năng.
- XP, streak, daily goal.
- Thống kê theo kỹ năng và lịch sử luyện.
- Responsive desktop/mobile.
- Loading/error/empty/not-found states.
- PWA manifest.

## Content contract

```text
RuntimeCourse
├── metadata
├── Lesson[]
│   ├── Vocabulary[]
│   ├── Grammar[]
│   ├── Listening[]
│   ├── Speaking[]
│   ├── Reading
│   ├── Writing
│   ├── Dialogues[]
│   ├── Pronunciation[]
│   ├── Culture[]
│   ├── ExtraSections[]
│   ├── sourceRef
│   └── quality
└── StudyQuestion[]
```

Learning UI chỉ đọc contract này, vì vậy importer có thể thay toàn bộ giáo trình mà không phải viết lại giao diện.

## Routes

```text
/                 Dashboard
/learn            Lộ trình giáo trình
/learn/[lesson]   Lesson workspace
/practice         Practice hub
/practice/quiz    Quiz session
/vocabulary       Flashcards
/listening        Listening
/speaking         Speaking
/reading          Reading
/writing          Writing
/review           Smart review
/stats            Progress
/import           PDF Content Ingestion Studio
/settings         Local settings
```

## Giới hạn thực tế

Không có pipeline AI/OCR nào bảo đảm 100% với mọi PDF scan xấu, chữ bị mất, trang xoay, bảng phức tạp hoặc nội dung âm thanh không nằm trong PDF.

Haneul ưu tiên **fail-safe**: giữ source reference, QA từng bài và dừng import khi grounding/coverage quá thấp thay vì giả vờ rằng dữ liệu đã chính xác.

Khi có audio chính thức của giáo trình, có thể bổ sung vào content pipeline để thay TTS bằng audio thật mà không thay workflow học.

## Architecture

Xem thêm:

- `docs/ARCHITECTURE.md`
- `docs/UX_REFERENCE.md`
