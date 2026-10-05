# Tiếng Hàn

Nền tảng ôn luyện tiếng Hàn bám sát giáo trình, hỗ trợ **Từ vựng – Ngữ pháp – Nghe – Nói – Đọc – Viết** theo từng bài học.

## Kiến trúc

```text
apps/
  web/        Next.js learner/admin UI
  api/        NestJS application API

packages/
  database/   Prisma schema + migrations

docs/
  ARCHITECTURE.md
```

### Source of truth

Mọi nội dung học tập phải truy vết được theo:

```text
Course -> Book -> Unit -> Section -> sourceRef
```

AI chỉ hỗ trợ tạo/luyện nội dung trong phạm vi giáo trình; nội dung AI sinh có trạng thái review trước khi publish.

## Yêu cầu

- Node.js >= 22.18
- pnpm 12
- Docker + Docker Compose

## Chạy local

```bash
cp .env.example .env

docker compose up -d

pnpm install
pnpm db:generate
pnpm db:migrate

pnpm dev
```

Sau khi chạy:

- Web: http://localhost:3000
- API: http://localhost:4000/api
- Health check: http://localhost:4000/api/health

## Scripts

```bash
pnpm dev
pnpm build
pnpm typecheck

pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

## Domain foundation

Schema ban đầu gồm:

- Course
- Book
- Unit
- Section
- Vocabulary
- GrammarPoint
- QuizItem

Quiz hỗ trợ nhiều dạng thay vì hard-code 4 đáp án: multiple choice, true/false, matching, fill blank, reorder, listening, dictation, speaking, reading comprehension, translation, short answer và writing.

Xem thêm [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
