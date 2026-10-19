# Sách điện tử có hình minh họa

Luồng học chính hiện mở **Bài học có hình**, tích hợp ảnh cắt ngay vào mục
từ/hoạt động; xem [cách tích hợp vào bài biên soạn](INLINE_LEARNING_ILLUSTRATIONS.md).
Trình đọc trang nguồn trong tài liệu này nằm ở tab **Sách gốc**. Người học
đọc ảnh trang gốc, lật trang, phóng to và mở văn bản hỗ trợ khi cần. Các tab
Tổng quan, Từ vựng, Ngữ pháp, Đọc và Bổ sung vẫn truy cập tự do.

## Phương án tích hợp

PDF có thể chứa ảnh raster, nét vẽ vector, chữ, bảng hoặc một ảnh scan nguyên
trang. Chỉ lấy ảnh nhúng không tái tạo đầy đủ bố cục đọc. Dùng hai lớp:

1. **Lớp trang sách:** render/lưu toàn bộ trang bằng PDF.js khi nhập tài liệu;
   phục vụ lại đúng snapshot khi đọc. Tranh, bảng, sơ đồ và chữ giữ cùng ngữ
   cảnh. Không coi scan nguyên trang là một tranh rời đã xác định nội dung.
2. **Lớp học tương tác:** nối từ vựng, ngữ pháp, hội thoại và trang bằng tài liệu
   + số trang trong `sourceRef`. Các trang hình/bảng gốc cũng xuất hiện dưới
   dạng ảnh xem trước ở màn từ vựng và ngữ pháp; chọn ảnh để mở đúng trang sách.

Đây là lựa chọn kỹ thuật của dự án dựa trên khả năng render toàn trang, render
vùng và trích ảnh của thư viện. Nguồn tham khảo chính thức:

- [PDF.js — ví dụ render trang và viewport](https://mozilla.github.io/pdf.js/examples/)
- [PyMuPDF — render ảnh trang, tăng độ phân giải, clip vùng và trích ảnh](https://pymupdf.readthedocs.io/en/latest/recipes-images.html)

Chưa tự động cắt từng tranh riêng và gán nghĩa cho từng từ: phải có tọa độ và
đối chiếu nội dung trước khi khẳng định một tranh minh họa cho từ/mẫu câu nào.
Giai đoạn hiện tại giữ nguyên ngữ cảnh trang, không tạo tranh thay thế rồi gắn
nhãn là hình trong giáo trình.

## Đọc và ôn

- **Bài đang học + trang liên quan** gồm mọi trang trong phạm vi bài và các
  trang nguồn được mục từ/ngữ pháp/bài tập/phụ lục tham chiếu. Không cắt ở một
  số trang cố định. Trang trùng được hợp nhất theo tài liệu + số trang.
- **Toàn bộ tài liệu** mở mọi trang được khai báo của tài liệu, gồm nhập môn,
  mục lục và phụ lục chưa gắn vào bài. Khi có đúng một bài phù hợp trang đang
  đọc, phần học tương tác dùng nội dung của bài đó; vị trí mơ hồ không tự đoán.
- Lưu vị trí đọc riêng theo khóa/bài, gồm chế độ đọc. Link từ màn ngữ pháp/từ
  vựng mang số trang và tên tài liệu để không nhầm hai file có cùng số trang.
- Có thể tắt **Học cùng trang** để tập trung vào ảnh sách. Phóng to cuộn trong
  khung, không làm trang ứng dụng tràn ngang trên điện thoại.
- Văn bản hỗ trợ đóng mặc định, mở theo yêu cầu để tránh chồng một khối OCR dài
  cạnh hình. Không lấy việc lật trang làm điểm hoàn thành hay điều kiện mở bài.
- Trang thiếu/hỏng ảnh vẫn giữ trong mục lục và có nút thử lại; vẫn đọc văn bản,
  sang trang khác hoặc chọn bài khác được.

## Dữ liệu và API

- `GET /api/courses/:id/lesson-book?lesson=N` trả manifest nhỏ, không nhúng ảnh
  base64. Tách trang bài và trang liên quan; cờ nguồn bất hợp lệ giữ rõ.
- `GET /api/courses/:id/source-image?document=doc-0&page=N` trả bytes ảnh gốc đã
  lưu, kiểm tra kiểu PNG/JPEG/WebP, `private, no-store` và `nosniff`. Có thể đọc
  một ảnh nhúng xác định bằng `image=<saved-id>`; không nhận đường dẫn file.
- `GET /api/courses/:id/source?...&view=text` trả toàn bộ văn bản trang mà không
  gửi lặp ảnh. Endpoint nguồn cũ giữ nguyên payload đầy đủ khi không chọn view.
- Ba endpoint dùng chung kiểm tra truy cập khóa, job nguồn và tài liệu khai báo.
  Khi dùng PostgreSQL, quyền được kiểm tra trước khi đọc snapshot private.
- Khi materialize khóa từ import job, media nguyên trang chuyển thành tham chiếu
  tới snapshot riêng. Giữ ID, caption, nguồn và mọi media; không nhân đôi toàn bộ
  ảnh trang vào khóa và IndexedDB. Media không xác định được nguồn vẫn giữ lại.

Pipeline nhập mới tạo preview cho **mọi trang đọc được**, kể cả trang không có
ảnh raster. Preview dùng scale 1.6, JPEG quality 0.85, tối đa 1.600 px bề ngang.
Bỏ giới hạn cũ 12 ảnh nhúng/trang. Preview toàn trang vẫn giữ được hình/bảng nhỏ
không được tách thành ảnh rời. PDF, ảnh sách và dữ liệu người học vẫn lưu private,
không commit vào repository.

## Phạm vi kiểm chứng

Thư viện local gồm 4 khóa / 60 bài. Kiểm tra tham chiếu cho thấy 1.214 lượt
trang được nối với bài, tương ứng 1.062 trang nguồn riêng có ảnh hợp lệ; phần
còn lại của 1.171 trang nguồn có thể đọc trong chế độ toàn tài liệu.

Kiểm tra trên dữ liệu local ngày 18/10/2026:

- 1.171/1.171 snapshot có ảnh đúng định dạng và đúng định danh tài liệu/trang.
- Manifest HTTP của cả 60 bài khớp phép ánh xạ nguồn trên đĩa; 60 ảnh mẫu qua
  API khớp SHA-256 với snapshot và có header riêng tư.
- 191 kiểm thử Vitest (gồm thư viện private), lint, typecheck và production
  build đạt. 30 kiểm thử trình duyệt đạt trên desktop/mobile: import thật,
  bytes ảnh từ endpoint với fixture tổng hợp, lật trang không để lại ảnh cũ, zoom, nhớ vị trí,
  link ảnh trong cùng bài và trang thiếu ảnh vẫn đi tiếp được.
- Đã xem giao diện với sách thực tế trên desktop và màn hình rộng 390 px.
  Detector không báo lỗi trong các component/CSS mới; 6 cảnh báo trong CSS
  dùng chung nằm ở các phần có sẵn ngoài thay đổi này.

Kiểm chứng kỹ thuật này chỉ xác nhận ánh xạ trang và khả năng đọc ảnh. Trạng
thái biên soạn giáo trình vẫn `partial`: chưa có kiểm kê độc lập đầy đủ từng
tranh, bảng, bài tập và đáp án. Không dùng số ảnh hoặc số trang để chứng nhận
đã biên soạn đủ nội dung sách.
