# Theo dõi biên dịch giáo trình

Trang `/import` có bảng **Theo dõi biên dịch**, luôn hiển thị dưới các bước nhập PDF. Chọn job để xem cả giáo trình cũ, làm mới hoặc đổi chu kỳ đọc trạng thái (5/10/30 giây) và thời gian cảnh báo (5/10/20 phút). Các lựa chọn được lưu trong trình duyệt; không thay đổi xử lý job.

## Ý nghĩa trạng thái

- `uploading`: nguồn chưa tải đầy đủ.
- `queued`: job đang chờ; chưa xác nhận worker nhận job trong lượt chờ hiện tại.
- `processing`: job đã được nhận. Trạng thái này không chứng minh worker vẫn chạy; xem checkpoint, bài học và thời điểm cập nhật.
- `ready`: bundle đã được lưu, đang chờ nhập vào Haneul.
- `consumed`: đã nhập khóa học.
- `failed`: plugin đã lưu lỗi; bảng hiện lỗi và hướng kiểm tra.

Không dùng mốc 75%/84% cố định làm phần trăm biên dịch. Số trang đã tải có mẫu số xác định. Số bài gợi ý từ PDF chưa phải tổng bài đã xác minh nên không dùng để tính phần trăm.

## Kết nối ChatGPT

Giữ plugin **Haneul Learning Bridge** và đường dẫn `/mcp`. Plugin vở bài tập `/worksheet-mcp` độc lập.

```dotenv
HANEUL_MCP_PUBLIC_URL=https://ten-mien-public
```

URL được hiển thị từ cấu hình máy chủ, bỏ đường dẫn/query/credentials. Nếu biến này trống, dùng origin của `HANEUL_WORKSHEET_PUBLIC_URL`; nếu không có HTTPS hợp lệ, bảng hiển thị `/mcp` và hướng dẫn bổ sung miền public.

Trong ChatGPT Work có bật Haneul Learning Bridge, dùng nút **Sao chép hướng dẫn kết nối**: kiểm tra server/discover, events/list; đăng ký và duy trì `import_job.queued`; xử lý theo contract hiện có, lưu checkpoint và lesson draft; kiểm tra cả job queued tồn tại trước khi đăng ký. Không chạy hai worker cho cùng job.

Số đăng ký còn hạn/khớp ngôn ngữ được đọc từ cấu hình sự kiện đã lưu. Đây chưa phải xác nhận giao callback thành công. Bảng không biết ChatGPT có đang xử lý bên trong hay không khi chưa có yêu cầu tới Haneul hoặc dữ liệu mới.

Production vẫn cần `HANEUL_MCP_TOKEN` theo cơ chế sẵn có; bảng chỉ hiển thị trạng thái cấu hình, không hiển thị token. Cảnh báo của bảng không đổi cơ chế tự requeue sau 20 phút không cập nhật của luồng nhập hiện có.

## Nhật ký và phạm vi quan sát

`src/proxy.ts` quan sát yêu cầu vào đúng `/mcp`, không sửa headers/body, không thay xác thực, không gọi compiler và không gửi lại job. Ghi nền bằng `NextFetchEvent.waitUntil`, lỗi ghi log không chặn handler.

Nhật ký chỉ giữ thời gian, phương thức RPC/tool trong allowlist, jobId, lessonId, phase và số trang. Không lưu cookie, Authorization, callback URL/secret, RPC ID, ảnh/text nguồn hoặc đáp án. Body được đọc từ bản clone, giới hạn 1 MiB và 1 giây; request gốc vẫn được chuyển nguyên vẹn. Với nội dung lớn/chậm/không phải JSON, chỉ ghi nhận yêu cầu HTTP và đánh dấu không đọc metadata.

Lưu ở `.haneul/import-monitor/requests.jsonl`, xoay vòng hai tệp khoảng 1 MiB mỗi tệp. Có thể đổi nơi lưu bằng `HANEUL_IMPORT_MONITOR_DIR`; tắt ghi bằng `HANEUL_IMPORT_MONITOR_DISABLED=1`. Nhật ký không tái tạo các lời gọi trước lúc triển khai, không có phản hồi từng tool, không có nội dung suy nghĩ nội bộ ChatGPT, và không ghi kết quả giao callback của hệ thống sự kiện cũ. “Đã nhận yêu cầu” không phải “tool thành công”. Đối chiếu với checkpoint/bài học/bundle đã lưu để xác nhận kết quả.

`GET /api/import-monitor?jobId=...` yêu cầu admin khi dùng PostgreSQL; production không cho truy cập ẩn danh kể cả chưa cấu hình DB. Endpoint trả `Cache-Control: no-store`, dữ liệu checkpoint đã rút gọn và metadata bài đã lưu, không trả toàn bộ lesson/question payload hay bí mật kết nối. Khi mất kết nối, UI giữ snapshot cũ, báo rõ lỗi và tự thử lại. Đổi job hoặc rời trang sẽ hủy lần đọc đang chờ.

Contract, tool schemas, kiểm tra source grounding, checkpoint store, course bundle và route `/mcp` được giữ nguyên. Không có migration DB.
