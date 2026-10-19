# Theo dõi công việc và nhịp học

Luồng vở bài tập hiển thị Lưu đề → Giao sự kiện → Đọc đề → Nhận đáp án → Dựng vở. HTTP 200 là bằng chứng giao webhook; chỉ read_worksheet và submit_worksheet xác nhận công cụ đã hoạt động. File chỉ sẵn sàng khi trình duyệt đã dựng PDF. Nhật ký ghi thời gian kiểm tra thành công gần nhất; đồng hồ cảnh báo vẫn chạy khi mạng mất.

Sau 2 phút không có hoạt động đọc/lưu mới, giao diện nêu điểm đang chờ và hướng kiểm tra tác vụ Work, hạn mức, quyền công cụ và tunnel. Không tự kết luận workspace hết credits và không tự gửi lặp. Haneul chưa có API để đọc hạn mức hoặc suy luận nội bộ của ChatGPT. Gửi lại đề là lựa chọn có chủ ý; webhook trùng có thể được phía nhận bỏ qua. Khi chưa có trạng thái mới, kiểm tra lượt chạy trước khi tạo job mới.

Luồng giáo trình hiển thị các trang đã lưu, job được nhận, checkpoint/bài học, bundle và nhập khóa học. Bảng theo dõi chỉ đọc dữ liệu, không thay đổi contract hay pipeline. Có thể điều chỉnh chu kỳ cập nhật và ngưỡng cảnh báo. Không ước lượng phần trăm từ số bài gợi ý và không suy ra công cụ thành công chỉ từ yêu cầu MCP tới máy chủ.

Yêu cầu đọc trạng thái, đăng nhập và tiến độ có thời hạn 15 giây. Các thao tác ghi bài tập có thời hạn 90 giây; hết thời gian chưa đủ để kết luận thao tác không được ghi. Không tự retry thao tác ghi. Đọc mỗi file PDF có giới hạn 45 giây và cập nhật số trang đã đọc. Phông chữ trang vở có thời hạn tải 15 giây; nếu lỗi vẫn giữ nội dung để sửa/xuất lại.

Luyện tập, ôn tập, nghe và đọc chấm câu lựa chọn ngay khi chọn. Câu đúng tự chuyển sau 3,5 giây; câu sai giữ phản hồi để người học đọc rồi tiếp tục. Bật/tắt được nhớ trên trình duyệt, có nút dừng cho từng câu. Trang ẩn hoặc màn hình đã rời đi không chạy timer. Nhận dạng nói đạt ngưỡng cũng tự chuyển sau phản hồi; tự đánh giá nói/viết vẫn cần người học xác nhận. Kết quả cuối phiên không tự chuyển trang.

Kiểm thử provider trọn vòng chỉ đạt khi thấy event giao → công cụ đọc đủ nguồn → kết quả lưu hợp lệ → PDF dựng thành công. Fixtures giao diện không thay thế bằng chứng này. Hết credits của workspace là giới hạn ngoài dự án; giao diện theo dõi vẫn hoạt động, nhưng không thể buộc ChatGPT xử lý.

Xác minh ngày 06/10/2026: typecheck, lint, build và 131 kiểm thử đạt. Đã tái hiện lỗi thu gom clone của Undici khiến body gốc không còn đọc được và thêm kiểm thử hồi quy; bộ quan sát giữ clone bằng WeakMap trong vòng đời request. Công cụ tools/list trên máy chủ cổng 3000 vẫn đọc body thành công và nhật ký có biên nhận. Kiểm tra trực tiếp phiên luyện tập và đọc: câu đúng tự sang câu, câu sai giữ lại, tổng kết đọc 1/2 đúng. Bảng theo dõi được kiểm tra desktop/mobile bằng dữ liệu mô phỏng có nhãn, trang chẩn đoán công khai đã xóa. PDF mẫu đã được tải và đọc lại để kiểm tra cấu trúc. Chưa xác nhận vòng xử lý tự động qua ChatGPT vì workspace đã báo hết hạn mức Work.
