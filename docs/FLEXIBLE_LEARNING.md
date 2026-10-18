# Học tự do và ôn toàn bộ bài — 2026-10-18

Mọi bài trong giáo trình đều truy cập được ngay, kể cả khi chưa có tiến độ.
Điểm số, mic, bàn phím và việc hoàn thành bài trước không phải điều kiện mở bài.
Tiến độ cũ vẫn được giữ để theo dõi và chọn mục cần ôn.

## Sử dụng

- Chạy `pnpm local` hoặc `Start-Haneul.cmd` trong đúng checkout. Giao diện và API
  cùng chạy ở `http://127.0.0.1:3000`; học local không cần backend riêng.
- Trang Giáo trình cho mở mọi bài. Trong màn học có bộ chọn **Học theo nhịp của
  bạn** để chuyển thẳng đến bài bất kỳ.
- Trang Luyện tập có **Bắt nghĩa**, **Nhớ ngược**, **Ghép mẫu câu**, **Xếp câu**.
  Chọn một bài hoặc toàn bộ giáo trình đang chọn; lọc mục yếu/đến hạn khi cần.
  Không có giới hạn tổng số từ/ví dụ. Bốn lựa chọn trên một màn là kích thước
  giao diện, không phải giới hạn nội dung.
- Câu sai/chưa nhớ được đưa vào lịch ôn. Cuối phiên có lượt chơi riêng các mục
  sai. Lưu sau khi chấm để tải lại trang không nhận XP hai lần cho lượt đó.
  Đổi nội dung/đáp án làm mất hiệu lực checkpoint không còn khớp.
- Bài quiz và luyện điền/dịch/nghe chép có cách **chạm để xếp** thay cho gõ.
  Mảnh trùng nhau có danh tính riêng nên câu có từ lặp vẫn xếp được đầy đủ.
  Chế độ có gợi ý được ghi rõ; nó không tương đương kiểm tra nhớ độc lập.
- Ở màn Nói, chọn **Không dùng mic · tự luyện** hoặc chuyển câu trực tiếp.
  Lỗi quyền mic/nhận dạng không chặn việc học. Tự luyện không được ghi thành
  điểm phát âm đã xác minh; bỏ câu không tự nâng điểm trung bình các câu còn lại.
- Có thể tắt tự chuyển sau câu đúng trong quiz để đọc phản hồi theo tốc độ riêng.

## Ngữ pháp và nguồn

Ngữ pháp có mục lục, giải thích đọc theo đoạn, ví dụ và bản dịch liền kề lấy
trực tiếp từ dữ liệu đã nhập. Không tóm tắt/cắt lưu ý hoặc giới hạn ví dụ. Mẫu
câu trùng giữa các sách có phần đọc thêm ghi rõ sách, bài và nguồn riêng; không
đoán các biến thể chia khác nhau là cùng mẫu.

Trong bản local đã đối chiếu trực tiếp trang PDF 56 (trang in 54) của Sơ cấp 1:
bản gốc dịch ví dụ có `사전` thành “quyển sách”. Giữ nguyên bản gốc và thêm ghi
chú biên soạn đính chính nghĩa “từ điển”, đồng thời nối chữ `있습니다` bị ngắt
dòng. Review có checksum PDF, bản sao lưu và nguồn riêng trong thư viện private.
PDF, nội dung sách và dữ liệu người học không đưa vào Git.

Kiểm tra thư viện thật cho thấy 4 khóa / 60 bài / 2.801 mục từ / 194 mục ngữ
pháp / 879 ví dụ, tạo 6.675 lượt chơi. Đây là số liệu của dữ liệu hiện có,
**không chứng minh đã bao phủ đầy đủ nội dung của sách**. Các khóa vẫn `partial`.
Còn phải đối chiếu inventory từng đơn vị nguồn, hình/bảng phức tạp, bài tập và
đáp án, phụ lục và các mục cũ chưa được kiểm chứng. Chưa có audio CD gốc.
Xem [hồ sơ khôi phục nguồn](ALL_LESSON_RECOVERY_2026-10-17.md).

## Kiểm chứng và bước tiếp theo

- `pnpm check`: lint, TypeScript và production build đạt.
- Vitest: 179 tests đạt khi bật `HANEUL_REGRESSION_LIBRARY` trỏ tới thư viện
  private. Kiểm tra mọi bài, từ, dòng giải thích và ví dụ thay vì lấy mẫu Bài 1.
- 26 Playwright E2E đạt trên desktop và mobile: mở bài từ tiến độ 0, chuyển bài,
  tự luyện không mic, chạm trả lời, câu sai và khôi phục game sau refresh.
- 6 test launcher, 9 test recovery Python, 3 test apply review đạt.
- Đã xem thực tế giao diện trước/sau, desktop và viewport 390×844. Chuyển động
  game dùng transform/opacity, tôn trọng `prefers-reduced-motion`.
- Detector không báo lỗi trong module UI mới; 6 cảnh báo thuộc CSS cũ nằm ngoài
  các dòng chỉnh sửa, không được coi là đã xử lý toàn bộ thiết kế cũ.

Bước tiếp theo để chứng nhận đầy đủ giáo trình: lập và đối chiếu inventory từng
mục trực tiếp từ nguồn, bắt đầu các bảng/hình/bài tập còn có cờ review trong
`sourceRecovery`. Không dùng số game/câu hỏi hoặc nguồn dự phòng để thay kiểm kê.
