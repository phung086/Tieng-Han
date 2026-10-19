# Docker local

Quy trình hằng ngày nằm ở [LOCAL_RUN.md](LOCAL_RUN.md): mở Start-Haneul.cmd,
đợi báo sẵn sàng, vào http://127.0.0.1:3000. Stop-Haneul.cmd giữ dữ liệu.

Compose project haneul gồm app (Next.js production: web và API) và db
(PostgreSQL 18). Image app là standalone build, không mount source, node_modules
hoặc .next của Windows. Chỉ .haneul được mount để cập nhật giáo trình/job mà
không build lại. Volume haneul_postgres_data giữ tài khoản, quyền và tiến độ.

Launcher tạo .env.docker riêng nếu chưa có, bảo toàn thông tin kết nối cũ và khóa
MCP. Image được kiểm tra bằng fingerprint mã/config; build lỗi không chạy nhầm
bản cũ. Mỗi lần đổi build có bản sao lưu DB trước khi khởi động/migration.
Healthcheck gọi backend kiểm tra DB/schema/runtime files. DB chỉ mở cổng loopback
cho phát triển; app mặc định tại 127.0.0.1:3000.

- pnpm local hoặc pnpm docker:start: build nếu cần, bật và chờ sẵn sàng.
- pnpm docker:stop: dừng, không xóa volume.
- pnpm docker:status: xem trạng thái.
- pnpm docker:backup: sao lưu DB; giữ thêm .haneul để có đủ sách và job.
- pnpm docker:logs: xem log, Ctrl+C chỉ thoát xem log.

Không chạy hai app cùng cổng, không prune Docker toàn máy và không dùng down -v.
Tài khoản/database cũ được giữ. Khi chuyển máy, sao lưu DB và dữ liệu filesystem,
khôi phục có kiểm tra trước khi thay hệ thống đang dùng. Không chép .env vào Git.
