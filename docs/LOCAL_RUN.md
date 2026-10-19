# Chạy Haneul trong một thư mục

Thư mục đang dùng trên máy này: D:/Tieng-Han/Tieng-Han. Mã, cấu hình riêng,
giáo trình, job và bản sao lưu nằm ở đây. PostgreSQL lưu trong Docker volume
haneul_postgres_data; dừng container không xóa tiến độ.

Mở Start-Haneul.cmd, rồi vào http://127.0.0.1:3000. Có thể đóng cửa sổ lệnh
sau khi báo sẵn sàng; ứng dụng và database chạy nền trong Docker. Stop-Haneul.cmd
dừng cả hai và giữ dữ liệu. Không cần bật backend bằng một lệnh khác.

PowerShell tương đương:

    Set-Location 'D:\Tieng-Han\Tieng-Han'
    pnpm local
    pnpm docker:status
    pnpm docker:stop

Máy cần Node.js 22+ và Docker Desktop. Launcher có thể mở Docker Desktop trên
Windows, chờ engine, kiểm tra cổng, tự build nếu mã thay đổi và chờ backend/database
sẵn sàng. Lần đầu build cần mạng; những lần sau dùng image đã có nếu mã không đổi.
Dependencies của ứng dụng được cài trong Docker; không cần pnpm install chỉ để mở
bản đã có. Lệnh CMD dùng node trực tiếp, pnpm là tùy chọn để dùng các alias trên.

Đăng nhập để lưu tiến độ theo tài khoản và khóa: kết quả, mục yếu/đến hạn, điểm
dừng quiz/drill/game, bản nháp viết/sổ luyện và dấu trang. Khách vẫn có thể học,
nhưng dữ liệu khách chỉ nằm trong trình duyệt đó. Khi có nút nhập tiến độ khách,
người học chủ động chọn nhập vào tài khoản; không tự ghép tài khoản khác.

Giữ cùng địa chỉ 127.0.0.1:3000 để thấy dữ liệu khách đã lưu. localhost và
127.0.0.1 là hai origin khác nhau. Khi offline, tiến độ tài khoản được giữ trong
cache riêng và gửi lại sau khi kết nối; nếu phiên khác đã cập nhật, ứng dụng báo
xung đột để chọn bản cần giữ, không âm thầm ghi đè.

Dữ liệu riêng ở .haneul gồm courses, active-course.json, import-jobs, originals,
recovered-source, mcp-events, worksheet-jobs/events và backups. Không commit dữ
liệu này hoặc .env.docker. pnpm docker:backup sao lưu database; cần giữ cả .haneul
để có hình/sách/job đầy đủ. Không chạy docker compose down -v: lệnh đó xóa database.

    pnpm local:check

Lệnh này kiểm tra đủ thư viện JSON. Khi chưa đăng nhập, API chỉ trả khóa được
xuất bản; khác biệt quyền truy cập không có nghĩa khóa đã bị xóa. Endpoint
/api/health kiểm tra database, migrations và thư mục dữ liệu, không lộ thông tin
đăng nhập. Luồng nhập nguồn vẫn qua /import và MCP theo quyền; OCR/biên soạn AI
cần kết nối provider thật, khởi chạy Docker không tự biên soạn sách.

Chế độ phát triển: pnpm install --frozen-lockfile, cấu hình .env.local rồi pnpm dev.
Dừng app Docker trước để nhường cổng. Không dùng chế độ này cho thao tác bật hằng ngày.
Nếu chủ động học không tài khoản/database: pnpm local:offline --data-dir .haneul.
Chế độ offline dùng cache trình duyệt, không đồng bộ PostgreSQL.

Thư viện hiện có 4 khóa/60 bài/194 mục ngữ pháp và 322 vùng hình đã duyệt.
Đồng bộ dữ liệu không phải chứng nhận biên soạn toàn sách: các khóa vẫn partial;
xem SOURCE_FIDELITY_REVIEW.md về phần cần đối chiếu nguồn.
