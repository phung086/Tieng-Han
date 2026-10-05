# Architecture — Local First

## Quyết định

Giai đoạn hiện tại dùng **một ứng dụng Next.js** thay vì tách web/API/database service.

Lý do:

- đây là ứng dụng cá nhân;
- cần thời gian phát triển tập trung vào nội dung và UX;
- local phải chạy nhanh, ít dependency hạ tầng;
- tách service sớm không tạo thêm giá trị cho bài toán học tập.

## Kiến trúc hiện tại

```text
Browser
  |
Next.js App Router
  |
UI + local learning state
  |
demo data / textbook seed
```

Phase dữ liệu tiếp theo:

```text
Next.js
  |
SQLite local file
  |
Course -> Book -> Unit -> Section
                  |-> Vocabulary
                  |-> Grammar
                  |-> Reading
                  |-> Listening
                  |-> Exercise
                  |-> Quiz
```

## Production sau này

Ưu tiên đường deploy đơn giản:

```text
1 Docker container
+ 1 persistent volume cho SQLite/media
+ backup định kỳ
```

Nếu nhu cầu thay đổi, tầng persistence sẽ được thay bằng Postgres/Turso mà không đổi luồng UI.

## Nguyên tắc domain

1. Giáo trình là source of truth.
2. Mỗi nội dung phải có `sourceRef`.
3. AI không tự quyết định curriculum.
4. Quiz sinh tự động phải review được.
5. Progress được lưu theo lesson + skill + knowledge item.
6. Gamification hỗ trợ động lực, không che mất mục tiêu học.


## MCP import bridge

AI compilation được tách khỏi UI bằng một import-job protocol.

```text
Browser PDF ingestion
  |
  v
Import Job Repository (.haneul/import-jobs)
  |                         ^
  v                         |
MCP /mcp -------------------+
  |
ChatGPT / MCP client
```

Browser chịu trách nhiệm PDF extraction và giữ media local. MCP đọc page snapshots theo chunk và chỉ trả structured curriculum. Course bundle được kiểm fingerprint trước khi nhận.

Repository hiện dùng filesystem local, nhưng interface được tách riêng để sau này thay bằng database/object storage mà không đổi MCP tools.

## Language profiles

Core import bridge dùng `LanguageProfile` thay vì giả định Korean-only:

```text
target language
learner language
speech locale
script
```

Profiles ban đầu gồm Korean, English và Chinese với learner language là Vietnamese. Runtime UI hiện vẫn Korean-first; phần legacy storage được cô lập khỏi MCP protocol để migrate dần sang generic content schema.
