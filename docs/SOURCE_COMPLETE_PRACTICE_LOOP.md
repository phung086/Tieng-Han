# Vòng lặp phát triển Source-Complete Practice

## Mục tiêu
Mỗi nguồn nhập phải có **manifest kiểm kê từ PDF/giáo trình gốc** theo book/lesson/page/section/item: từ mới; câu ví dụ ngữ pháp; câu thoại; câu đọc mẫu; câu nghe; bài tập gốc; đáp án; kiểu bài; nội dung minh họa. Không dùng số câu quiz làm đại diện cho số lượng tri thức.

## Phân biệt 3 cổng nghiệm thu
1. **Source inventory**: đếm từng item *trong tài liệu gốc*, lưu ID ổn định, trang và anchor cụ thể; OCR không rõ phải gắn cờ cần kiểm chứng, không được đoán.
2. **Compiled coverage**: kiểm tra từng source item đã được import đầy đủ với sourceRef duy nhất. Không lấy số mục từ compiled bundle làm mẫu số của PDF nếu không có manifest.
3. **Practice coverage**: mỗi mục cần được ôn có hình thức bài phù hợp, có liên kết source item cụ thể, đáp án/đánh giá và số lần ôn; bài tập gốc giữ nguyên motif, thứ tự, ý nghĩa, vai hội thoại. Chỉ đánh dấu 100% khi đủ cả 3 cổng và đối chiếu tay những trang không thể parse chắc chắn.

`auditLessonPracticeCoverage` là **cổng phụ mức bundle**, chưa phải chứng chỉ 100% so với PDF. Trường `sourceRef` ở cấp đoạn dùng chung cho nhiều câu không chứng minh được coverage; worker phải tạo reference tới từng item riêng biệt hoặc báo "ambiguous". `speaking` dạng chuỗi hiện chưa có item-level reference nên phải được báo thiếu xác minh, không được tự nhận đạt.

## Chống giới hạn ngầm
- Guided và mastery: dùng **tất cả** câu có trong ngân hàng bài, không giới hạn 8/10.
- Quick 5 là chế độ tự chọn, không được dùng để tính full coverage.
- Số bài tập sinh ra phải theo nhu cầu từng source item, không ép 1 bài/từ nếu giáo trình yêu cầu nhiều phép luyện.
- Ôn luyện chia phiên/pagination hợp lý, nhưng tiến độ phải lưu qua mọi phiên, không làm rơi câu ở trang sau.
- Đổi cấu trúc metadata một cách additive, giữ tương thích Course Bundle/import job/MCP checkpoint và các khóa cũ.

## Ưu tiên và vòng lặp
P0: chốt inventory schema, item-level refs; báo coverage theo bài, trace PDF-page; không bỏ bất kỳ item nào; regression với tài liệu thực tế.
P1: bổ sung đầy đủ các dạng bài tương ứng bản gốc, đáp án, tự chấm hoặc kiểm tra thủ công và lịch ôn.
P2: cải thiện flow học, chia phiên dài, resume, tránh ngộ nhận bài hoàn thành khi chưa hết câu.
P3: UI mobile/desktop, theo dõi nguồn, độ bao phủ, hiệu năng.

Mỗi chu kỳ: refresh main -> đọc PR/file của nhánh khác -> chọn một phần việc độc lập -> sửa trên nhánh riêng -> kiểm lint/typecheck/unit/build/e2e -> đối chiếu inventory và report sai lệch -> mở/update PR chờ review. Nếu xung đột, ngừng thay đổi file chung và chia task/PR; **không force push**, không tự merge và không can thiệp pipeline import.

## Tiêu chí Done
Từng giáo trình đã nhập: original_inventory_count == imported_item_count (theo từng loại) và all required item IDs có bài ôn tương ứng; các câu gốc có mẫu thức đúng; câu không chắc nguồn không được tính đạt; mọi regression/CI pass; không ảnh hưởng import tự động. Nguồn mới upload phải kích hoạt kiểm kê và đối chiếu riêng, không cần sửa số lượng hardcode.

Lưu ý: bản PR đầu tiên mới xóa cap 8 câu và thêm audit fail-closed cho bundle. Chưa có bản kiểm kê từng trang của PDF và chưa thể khẳng định các giáo trình đã nhập đạt 100%.
