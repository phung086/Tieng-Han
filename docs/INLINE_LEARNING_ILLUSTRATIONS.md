# Hình minh họa trong bài học

Màn `/learn/:lessonId` mở **Bài học có hình**: ảnh cắt nằm ngay cạnh mục từ,
nút nghe và nghĩa có thể ẩn để tự nhớ. Ảnh còn dùng trong flashcard và lượt
ôn từ của trò chơi. Không cần mở sách để học cùng hình. **Sách gốc** giữ vai
trò tham khảo; link có `page`/`file` vẫn mở đúng trang nguồn.

Ngữ pháp giữ nguyên giải thích, ví dụ và bản dịch đã nhập, thêm sơ đồ
mẫu → câu ví dụ, chạm từng cụm để nghe. Đây là cách trình bày trực quan của
câu nguồn, không phải phân tích cú pháp hay quy tắc mới được suy đoán.

## Hợp đồng và API

`LessonContent.illustrations` chứa `id` duy nhất trong khóa, `kind`
(`vocabulary|grammar|dialogue|context`), `targetIds`, `relation` (`exact|context`),
`fileName`, `pageNumber`, `region: [x,y,width,height]` chuẩn hóa 0–1, `alt`,
`caption`, `sourceRef`. Vùng phải nằm trong trang, có kích thước dương và
nhỏ hơn 80% diện tích trang. `exact` chỉ gắn một mục từ tồn tại. Ảnh tình huống
không giả làm đáp án chính xác. Bundle kiểm tra vùng, ID trùng và ID mục học;
metadata được giữ nguyên qua chuẩn hóa. Compilation contract mô tả cả trường này.

`GET /api/courses/:id/illustrations?id=...` chỉ nhận ID ảnh đã lưu trong khóa.
Quyền và tài liệu được kiểm tra trước khi đọc snapshot. Tọa độ/file trong URL
không thể thay vùng cắt. `sharp` tạo JPEG từ vùng đã lưu, giới hạn pixels đầu
vào; header `private, no-store`, `nosniff`. Ảnh thiếu có nút thử lại, nội dung
học vẫn dùng được. Xem ảnh không tự trao XP hoặc khóa bài.

## Chuẩn bị và rà hình

`python scripts/compile-lesson-illustrations.py --data-dir <private-data> --output <review-dir>`
tạo ứng viên/contact sheet, không sửa khóa. Cần PyMuPDF, Pillow, NumPy,
opencv-python-headless. Chữ pdfplumber đổi tọa độ MediaBox → CropBox; OCR
dùng tọa độ ảnh render. Cặp ảnh/chú thích phải được xem lại trước khi duyệt;
khung viết, mảnh mask và ảnh mơ hồ không được tính thành hình mục từ.

Manifest duyệt cần `approvedIds` và `reviewedBy`.
`node scripts/apply-reviewed-illustrations.mjs --data-dir <private-data> --review <reviewed.json>`
kiểm tra trước; thêm `--apply` để ghi. Script kiểm tra SHA-256 nguồn, vùng và
mục tiêu; sao lưu khóa/job trước khi ghi; chỉ thêm/thay metadata ảnh đã duyệt.
Không rút gọn bài, ngữ pháp, ví dụ, câu hỏi hoặc sửa tiến độ học.

## Kiểm chứng local ngày 19/10/2026

317 hình duyệt trong 4 khóa: 195 hình mục từ, 122 hình ngữ cảnh. 46/60 bài có
hình nguồn được duyệt. Sơ cấp 2 Bài 5 và 13 bài sách bài tập chưa có hình rời
đủ rõ được duyệt. Không gắn ảnh sai hay nguyên trang chữ để tạo số bao phủ.
Ngữ pháp vẫn có sơ đồ từ các câu ví dụ đã nhập.

317/317 ảnh HTTP khớp bytes vùng cắt từ snapshot. Mọi trường ngoài
`illustrations` trong khóa khớp bản sao lưu. Các khóa vẫn có trạng thái biên
soạn `partial`; số ảnh không chứng minh đã kiểm kê đủ nội dung sách.

Lint/typecheck/production build đạt; 199 Vitest với thư viện private,
34 Playwright desktop/mobile và 2 kiểm thử apply/backup đạt. Detector không
báo vấn đề trên các component/CSS thay đổi. Đã xem trực tiếp màn học desktop;
kiểm tra trực quan mobile bản cuối chưa thực hiện được vì Browser trong Work
bị tắt; các kiểm thử mobile tự động về ảnh, lỗi ảnh và tràn ngang đã đạt.

PDF, contact sheet, manifest duyệt và dữ liệu khóa nằm private, không commit.
Bước nội dung tiếp theo: rà vùng chưa ghép được, bổ sung các hình thật còn
thiếu và kiểm kê độc lập toàn bộ tranh/bảng/bài tập, nhất là sách scan.
