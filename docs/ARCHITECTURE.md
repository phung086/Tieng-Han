# Kiến trúc dự án

## Mục tiêu

Tiếng Hàn là nền tảng ôn luyện bám sát giáo trình. Mọi nội dung luyện tập phải truy vết được về:

`Course -> Book -> Unit -> Section -> Source reference`.

## Monorepo

- `apps/web`: Next.js — giao diện học viên và admin.
- `apps/api`: NestJS — API nghiệp vụ.
- `packages/database`: Prisma schema và migrations.
- Package dùng chung sẽ bổ sung khi bắt đầu auth, design system và AI pipeline.

## Domain ban đầu

- Course
- Book
- Unit
- Section
- Vocabulary
- GrammarPoint
- QuizItem

Quiz không bị khóa vào cấu trúc A/B/C/D. Payload nội dung, choices và answer dùng JSON để hỗ trợ nhiều loại bài: multiple choice, matching, fill blank, reorder, dictation, speaking, reading comprehension, translation và writing.

## Nguyên tắc kiến trúc

1. Giáo trình là source of truth.
2. Nội dung AI sinh phải có sourceRef và trạng thái review.
3. AI không tự quyết định curriculum.
4. UI, API, database và pipeline nhập giáo trình được tách biệt.
5. Feature học tập phải gắn với Book/Unit/Skill.
6. Không public nguyên nội dung có bản quyền nếu chưa có quyền sử dụng.
