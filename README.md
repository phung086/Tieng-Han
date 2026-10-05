# Haneul — Tiếng Hàn

Ứng dụng cá nhân để học và ôn luyện tiếng Hàn bám sát giáo trình: **Từ vựng · Ngữ pháp · Nghe · Nói · Đọc · Viết**.

## Trạng thái

UI/UX và các luồng học chính đã được dựng hoàn chỉnh bằng dữ liệu demo. Bước tiếp theo là nhập giáo trình thật và map dữ liệu vào các component hiện có.

## Chạy local

Yêu cầu Node.js 22+.

```bash
corepack enable
pnpm install
pnpm dev
```

Mở http://localhost:3000.

Kiểm tra toàn bộ project:

```bash
pnpm check
```

## Chức năng hiện có

- Dashboard cá nhân: bài đang học, review hôm nay, skill cards, XP/streak.
- Learning path theo giáo trình.
- Lesson workspace theo từng bài.
- Từ vựng: flashcard, Korean TTS, tự đánh giá nhớ/chưa nhớ.
- Ngữ pháp & quiz: multiple choice, input, reorder, phản hồi và giải thích ngay.
- Nghe: Korean browser TTS, tốc độ chậm, câu hỏi nghe hiểu.
- Nói: shadowing + browser SpeechRecognition khi trình duyệt hỗ trợ.
- Đọc: passage, ẩn/hiện bản dịch, câu hỏi đọc hiểu.
- Viết: textarea, rubric local, feedback tức thời.
- Smart review.
- Thống kê theo kỹ năng từ dữ liệu thực tế trong local state.
- Cài đặt và reset dữ liệu demo.
- Local persistence qua `localStorage`.
- Responsive desktop/mobile + bottom navigation.
- PWA manifest.

## Routes

```text
/                 Dashboard
/learn            Lộ trình giáo trình
/learn/3          Lesson workspace demo
/practice         Practice hub
/practice/quiz    Quiz session
/vocabulary       Flashcards
/listening        Listening lab
/speaking         Speaking lab
/reading          Reading lab
/writing          Writing lab
/review           Smart review
/stats            Progress
/settings         Local settings
```

## Kiến trúc

Hiện tại là **một Next.js app local-first**. Không cần PostgreSQL, Docker hay API server riêng để học local.

Dữ liệu giáo trình thật sau này sẽ được chuẩn hóa theo:

```text
Course -> Book -> Unit -> Section -> sourceRef
```

Persistence phase tiếp theo có thể dùng SQLite/local file mà không cần đổi UX.

Xem:
- `docs/ARCHITECTURE.md`
- `docs/UX_REFERENCE.md`
