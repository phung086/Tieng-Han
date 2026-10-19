# Chạy Haneul bằng Docker trên máy local

Haneul dùng Next.js cho cả web và backend: các API `/api/*`, `/mcp` và `/worksheet-mcp` nằm trong cùng dịch vụ `app`, cổng 3000. PostgreSQL là dịch vụ `db`. Docker Desktop hiển thị cả hai trong nhóm **haneul**.

## Bật/tắt

Mở Docker Desktop trước. Chạy lệnh trong checkout đang dùng:

```powershell
cd D:\Tieng-Han\Tieng-Han
pnpm docker:start
pnpm docker:status
```

Mở http://localhost:3000. Trong Docker Desktop → Containers → **haneul**, có thể bấm Start/Stop cho cả nhóm. Nếu bật riêng từng container, bật `db` trước rồi `app`.

```powershell
pnpm docker:stop
pnpm docker:start
pnpm docker:logs
```

`docker:logs` theo dõi nhật ký; Ctrl+C chỉ thoát xem log. `docker:status` hiển thị `healthy` khi PostgreSQL và backend đã sẵn sàng. Nếu thay dependencies hoặc Dockerfile:

```powershell
pnpm docker:up
```

Lần đầu trên một máy/checkout mới:

```powershell
pnpm docker:setup
pnpm docker:up
```

`docker:setup` tạo `.env.docker` riêng, giữ cấu hình API/MCP từ `.env.local` và không in mật khẩu. Nếu file đã có, script giữ nguyên. Đây là cấu hình phát triển local, không phải bản triển khai production. Không có dữ liệu cũ trên máy mới thì database được tạo mới và migration chạy tự động.

## Dữ liệu và cổng

- Database: named volume `haneul_postgres_data`, mount tại `/var/lib/postgresql` theo cấu trúc PostgreSQL 18.
- Giáo trình, job, checkpoint, đăng ký MCP và bài tập: thư mục `.haneul` của checkout hiện tại, được bind vào `/app/.haneul`.
- Source được bind vào container để tiếp tục phát triển. Dependencies Linux và cache Next.js nằm trong volume riêng, không ghi đè `node_modules` hoặc `.next` của Windows.
- Cổng host mặc định: `127.0.0.1:3000` cho web, `127.0.0.1:5432` cho PostgreSQL. Có thể đổi `HANEUL_WEB_PORT`, `HANEUL_DB_PORT` trong `.env.docker`, rồi chạy `pnpm docker:up`.
- Bên trong container, app kết nối `db:5432`; `.env.local` cho chạy trực tiếp Windows vẫn dùng `localhost:5432`.
- Ngrok hiện có vẫn chuyển tiếp cổng 3000. Docker không tự chạy hoặc thay đổi ngrok; giữ tunnel chạy nếu cần ChatGPT Cloud gọi MCP.

Stop/Start giữ dữ liệu. Không dùng `docker compose down -v`: tùy chọn `-v` xóa volume database. Không chạy PostgreSQL Windows và Docker cùng cổng 5432 hoặc hai bản web cùng cổng 3000.

Sao lưu database đang chạy bằng `pnpm docker:backup`; file nằm trong `.haneul/backups`. Giáo trình và các thư mục job/MCP là dữ liệu filesystem riêng: sao chép `.haneul` khi nhóm đã dừng để giữ một bản sao đồng nhất. Nếu sửa code trên Windows mà trang chưa cập nhật, chạy `docker compose --env-file .env.docker restart app`.

## Chuyển dữ liệu đã thực hiện ngày 07/10/2026

Đã sao lưu database Windows bằng `pg_dump` vào `.haneul/backups/before-docker-2026-10-07-*.dump`, khôi phục vào Docker rồi so sánh số dòng và SHA-256 nội dung của đủ 7 bảng ở cùng múi giờ UTC. Tài khoản/quyền, hash mật khẩu, sessions, enrollment, tiến độ, catalog và migration được giữ nguyên. Role `haneul_app` trong Docker không có quyền superuser. Cluster Windows gốc không bị xóa; đã dừng để nhường cổng.

Mật khẩu database Docker nằm trong `.env.docker` riêng; không đưa file này lên Git. Việc chuyển database không đổi mật khẩu đăng nhập Haneul.

Đã kiểm tra Stop → Start, sao lưu database, đăng ký/đăng nhập bằng tài khoản QA tạm rồi xóa tài khoản đó, cookie phiên, từ chối mật khẩu sai, quyền learner, đọc giáo trình và hai endpoint MCP. Hai dịch vụ đều `healthy`. Đã sửa kiểm tra same-origin để dùng Host của đích trình duyệt khi Next.js nhận URL nội bộ `0.0.0.0`; kiểm thử vẫn từ chối origin khác cổng/giao thức và forwarded-host giả. Typecheck, lint, build và 134 kiểm thử đạt; build còn hai cảnh báo tracing có sẵn trong file compiler được bảo vệ.

## Chạy web trực tiếp Windows khi cần

Giữ database Docker chạy, dừng container `app` rồi chạy web trên Windows:

```powershell
docker compose --env-file .env.docker stop app
pnpm dev
```

Để quay lại Docker, dừng `pnpm dev` bằng Ctrl+C rồi `pnpm docker:start`.

Nếu muốn quay lại database Windows gốc: dừng cả nhóm Docker trước, khởi động cluster Windows bằng `pg_ctl`, rồi `pnpm dev`. Cluster đó là bản dữ liệu trước khi chuyển; dữ liệu mới trong Docker không tự đồng bộ trở lại. Cần backup/restore nếu muốn mang các thay đổi mới về Windows.

Tài liệu cấu trúc volume: [Docker Official Image PostgreSQL](https://hub.docker.com/_/postgres).
