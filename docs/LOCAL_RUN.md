# Chạy đúng bản Haneul local

Haneul dùng một máy chủ Next.js cho cả giao diện và các API backend. Để học với
thư viện JSON đã nhập, không cần một backend riêng, PostgreSQL hoặc AI API key.
Tiến độ trong chế độ này được lưu tại trình duyệt, theo từng khóa học.

## Mở ứng dụng

Tại thư mục chứa `package.json` của bản code đã tối ưu:

```powershell
pnpm install --frozen-lockfile
pnpm local
```

Lần đầu cần cài Node.js 22+ và pnpm theo phiên bản `packageManager` trong
`package.json`. Máy đã có dependencies thì không cần chạy install lại.
Windows có thể mở `Start-Haneul.cmd` trong đúng thư mục dự án.

Mở http://127.0.0.1:3000 và giữ terminal chạy. Nhấn Ctrl+C tại terminal đó để
dừng. Lệnh in đường dẫn code, Git commit, đường dẫn dữ liệu, số bài và số mục
ngữ pháp của từng khóa trước khi khởi chạy. Nó build lại khi các file ứng dụng
đổi hoặc chưa có production build; nếu build lỗi, nó không mở một build cũ.
Một máy chủ khác đang chiếm cổng sẽ không bị tự dừng.

```powershell
pnpm local:check
pnpm local --port 3007
pnpm local --rebuild
```

`--check` chỉ kiểm tra dữ liệu và đường dẫn; không mở máy chủ. `--rebuild` cần
dừng máy chủ đang dùng cổng đó trước. Lệnh local chỉ nghe tại `127.0.0.1`.
Nếu máy chủ đang chạy, `--check` còn đối chiếu toàn bộ payload API với thư viện
trên đĩa, gồm mọi bài, mục ngữ pháp, ví dụ, câu hỏi và các trường mở rộng. Kết
quả không dựa riêng vào việc hai bên có cùng số lượng bản ghi.

## Chọn đúng dữ liệu bài học

Code GitHub không chứa giáo trình riêng. Một clone mới chỉ có code sẽ không tự
có lại sách đã nhập. Giữ đầy đủ các thư mục/file sau trong thư mục dữ liệu:

```text
courses/                 Mọi khóa học, toàn bộ lessons và questions, gồm grammar
active-course.json       Khóa đang được chọn mặc định
import-jobs/             Snapshot trang, hình, nguồn gốc và kết quả import
mcp-events/              Sự kiện import nếu sử dụng
```

Cấu hình riêng tại `.haneul/local-settings.json` (được Git bỏ qua):

```json
{ "dataDir": ".haneul/fidelity-test" }
```

Hoặc chỉ định một thư mục khác có dữ liệu đã nhập:

```powershell
pnpm local --data-dir "D:\Haneul-Data"
```

Thứ tự chọn: `--data-dir`, biến `HANEUL_LOCAL_DATA_DIR`, file cấu hình trên,
rồi mặc định `.haneul`. Thư mục tương đối được tính từ thư mục dự án, không phụ
thuộc terminal đang ở đâu. Lệnh không tự ghi đè hoặc ghép nội dung hai khóa.
Nó đọc mọi khóa/bài/ngữ pháp, báo rõ lỗi và các bài chưa có ngữ pháp; không cắt
để vừa số câu quiz. Dữ liệu thay đổi không đòi hỏi build lại giao diện; tải lại
trang để trình duyệt lấy toàn bộ thư viện mới từ API.

Trong giao diện **Giáo trình**, chọn khóa rồi bài học. Mở **Ngữ pháp** trong bài;
đường dẫn `/grammar?lesson=15` có nghĩa Bài 15 của khóa hiện đang chọn. Số bài
không định danh khóa học; khi đổi giáo trình cần chọn đúng khóa trước.

## Khi nào cần PostgreSQL hoặc biên soạn AI

`pnpm local` cố ý chạy chế độ học local, không bật `DATABASE_URL`. Nếu cần tài
khoản, phân quyền và đồng bộ tiến độ giữa thiết bị: cấu hình PostgreSQL,
`DATABASE_URL`, chạy `pnpm db:migrate`, rồi chạy theo
[PHASE_SCALE_1_SETUP.md](PHASE_SCALE_1_SETUP.md). Backend vẫn nằm cùng ứng dụng
Next.js; PostgreSQL là dịch vụ dữ liệu bổ sung.

Học các bài đã nhập không gọi AI. Tự biên soạn thêm từ sách cần một provider
hoặc Learning Bridge được cấu hình và xác thực thật. Chạy máy chủ local không
đồng nghĩa mọi bài sẽ tự được biên soạn lại. Đồng bộ đủ dữ liệu hiện có cũng
không chứng nhận sách đã được biên soạn đủ: trạng thái `partial`/`unverified`
vẫn giữ cho đến khi kiểm kê từng đơn vị nguồn.
