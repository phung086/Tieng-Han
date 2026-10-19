# Kết nối ChatGPT để tự làm và xuất vở bài tập

Mở `http://localhost:3000/worksheets` và đăng nhập bằng tài khoản Haneul của bạn.
Không cần OPENAI_API_KEY. Bước kết nối ChatGPT dưới đây chỉ làm một lần cho tài
khoản; mỗi bài sau đó được gửi từ giao diện Haneul.

## Cấu hình một lần trong ChatGPT

1. Mở [ChatGPT Plugins](https://chatgpt.com/plugins), bấm dấu cộng → **Add custom
   MCP server**. Đặt tên **Haneul Vở bài tập** và mô tả đọc/giải/dịch bài tập.
2. Chọn kết nối bằng URL HTTPS. Tunnel hiện tại, kiểm tra ngày 06/10/2026:

   `https://projector-blaspheme-angelfish.ngrok-free.dev/worksheet-mcp`

   Chọn **No authentication**, xem thông tin kết nối, rồi **Create as a plugin**.
   Quyền xử lý vẫn được kiểm tra bằng mã kênh và mã riêng cho từng bài. Địa chỉ
   localhost không thể dùng trực tiếp từ ChatGPT Cloud. Nếu tunnel đổi địa chỉ,
   cập nhật URL của plugin. Có thể dùng Secure MCP Tunnel theo tài liệu OpenAI.
3. Nếu plugin đã tạo trước đây, mở nó và chọn **Refresh**. Phải thấy hai công cụ
   `read_worksheet`, `submit_worksheet` và sự kiện `worksheet_job.queued`.
4. Cài/bật plugin trong một cuộc trò chuyện **Work** trên ChatGPT web; trên desktop
   chọn **Work** và **Cloud**. Chọn plugin bằng `@` trong ô nhập. Chat thường không
   thay thế được cuộc trò chuyện đăng ký sự kiện. Chính sách tài khoản/workspace
   cần cho phép plugin và tác vụ kích hoạt từ sự kiện.
5. Quay lại Haneul, mở **Kết nối ChatGPT một lần**, bấm **Tạo lệnh cấu hình một
   lần**, rồi **Sao chép cấu hình**. Dán vào cuộc trò chuyện Work/Cloud vừa mở.
   Lệnh có mã kênh ngẫu nhiên riêng cho tài khoản; không đăng mã này công khai.
6. ChatGPT gọi `events/subscribe`, cấp URL callback và signing secret. Haneul
   gửi challenge có chữ ký, kiểm tra câu trả lời rồi lưu đăng ký. Chờ giao diện
   Haneul báo **Đăng ký nhận sự kiện đang còn hạn**. Đây là bằng chứng đăng ký,
   chưa xác nhận tác vụ AI đã chạy hoặc việc tự gia hạn trong tương lai.

Sau bước này: **chọn file hoặc dán câu đề → tự gửi → ChatGPT đọc/giải/dịch và lưu
trả → Haneul tự hiện kết quả và chuẩn bị PDF → bấm Tải PDF/Tải PNG**. Không cần
sao chép lệnh cho từng bài, nhập JSON hay bấm nhận kết quả. Các mục sửa câu và
nhập JSON chỉ là lựa chọn bổ sung. Với đề đã chọn trước khi kết nối, bấm **Giải &
dịch tự động** một lần để gửi đề đó.

## Kiểm tra và khắc phục

- Máy chạy Haneul, PostgreSQL và tunnel phải hoạt động. Khi dùng localhost, website
  và server vẫn nằm trên máy của bạn; ChatGPT chỉ truy cập qua tunnel đã cấu hình.
- **Chưa kết nối tự động**: kiểm tra Work/Cloud, plugin được bật, Refresh và thao
  tác đăng ký. Việc hai công cụ xuất hiện chưa có nghĩa là đã đăng ký sự kiện.
- **Đề đã lưu, chưa gửi được**: kiểm tra tác vụ ChatGPT/tunnel, rồi bấm **Gửi lại
  đề**. Mã sự kiện giữ nguyên để tránh tạo lượt xử lý trùng.
- **Đang chờ** lâu: kiểm tra lượt chạy trong cuộc trò chuyện ChatGPT. Webhook 2xx
  chỉ xác nhận ChatGPT nhận sự kiện, không xác nhận AI đã giải xong. Website không
  tự gọi model khi thiếu API key và không giả lập đáp án để báo thành công.
- Giao diện hiển thị bốn mốc thật: lưu đề, giao sự kiện, công cụ đọc đề/trang ảnh,
  lưu đáp án. Nhật ký có thời gian và mã HTTP, cập nhật mỗi 6 giây trong lúc chờ.
  Sau 2 phút không có hoạt động mới, kiểm tra tác vụ Work/Cloud: lịch gộp sự kiện,
  quyền chạy và lỗi công cụ. Website không đọc được suy luận nội bộ hoặc trạng thái
  tác vụ ChatGPT; không thể kết luận AI đang xử lý chỉ dựa trên webhook 200.
- Với bài đã tạo trước khi có nhật ký, chưa có dữ liệu lịch sử để dựng lại. Bấm
  **Gửi lại đề** ghi nhận lần giao tiếp tiếp theo; không cần dán prompt lại.
- Nếu ChatGPT/Plugin Creator báo **403, không có quyền sử dụng plugin có MCP**,
  quản trị viên workspace phải cho phép MCP/custom plugin hoặc người dùng cần
  chọn một workspace được phép. Gói ZIP đã tạo và đăng ký webhook thành công
  không chứng minh plugin đã được cài/bật trong tác vụ nhận sự kiện. Kiểm tra
  plugin **Haneul Vở bài tập** trong chính tác vụ **Giải bài Haneul tự động**:
  phải có cả `read_worksheet` và `submit_worksheet`. Plugin Creator tạo gói;
  công cụ tạo gói không thay thế hai công cụ xử lý đề.
- Câu mờ/thiếu dữ kiện giữ đáp án trống kèm cảnh báo ở phần nội dung. Có thể sửa
  trước khi tải; không thể đảm bảo mọi đáp án AI đúng tuyệt đối. Cảnh báo và tiêu
  đề giáo trình không được vẽ vào trang vở.
- **Ngắt kết nối ChatGPT** trên Haneul thu hồi mã kênh và đăng ký; bật lại bằng mã
  mới. Dừng theo dõi trong ChatGPT gọi `events/unsubscribe`. Mỗi tài khoản chỉ có
  một callback đang hoạt động; đăng ký cuộc trò chuyện mới thay thế callback cũ.

## Kiến trúc và quyền truy cập

`src/lib/worksheet-events.ts` là kho riêng; không import hoặc sửa
`src/lib/mcp-events.ts`, `/mcp` hay bộ biên dịch giáo trình. Không thay đổi schema
PostgreSQL. Các API tạo/đọc/xóa/gửi lại/kết nối dùng đăng nhập Haneul và kiểm tra
same-origin cho thao tác ghi. Production không cho phép owner local chưa đăng nhập.

Kênh và đăng ký lưu bền ở `.haneul/worksheet-events` (đổi bằng
HANEUL_WORKSHEET_EVENTS_DIR). Mã kênh và webhook secret được lưu như credential
máy chủ trong thư mục riêng bị gitignore, file mode 0600; trên Windows cần bảo vệ
quyền NTFS/backup tương ứng. Mã truy cập bài vẫn chỉ lưu hash trong kho bài tập.
Không expose API liệt kê bài qua MCP. Mỗi subscription yêu cầu mã kênh hợp lệ;
sự kiện chỉ gửi jobId/accessKey/sourceDigest/expiry, không gửi toàn bộ nguồn.

Callback bắt buộc HTTPS:443, không user/password/fragment, DNS được kiểm tra và
pin vào địa chỉ công cộng ngay khi kết nối TLS. Không theo redirect. Verification
và delivery ký Standard Webhooks, timeout/response bounded. Retry tối đa ba lần
với backoff; 410 gỡ đăng ký, 413 không retry. Secret rotation ký cả khóa cũ/mới
trong 5 phút. Đăng ký mặc định 180 ngày, tôn trọng ttlMs hữu hạn (minimum 60 giây),
`ttlMs:null` vẫn được cấp hạn hữu hạn; ChatGPT cần refresh trước khi hết hạn.
Không replay; nguồn bài có hạn 24 giờ. Gửi lại từ UI là cách khôi phục khi gián
đoạn, không có worker/outbox chạy ngầm ngoài vòng đời request. Kho/mutex thiết kế
cho một server local; triển khai nhiều instance cần một shared store/queue.

Nhật ký `.haneul/worksheet-events/activity` chỉ lưu tối đa 100 mốc cho mỗi bài,
không lưu câu đề, accessKey, channelKey, chữ ký hay URL callback. API đọc nhật ký
kiểm tra chủ sở hữu trước; xóa bài xóa cả nhật ký. Nhật ký quá 48 giờ được dọn khi
có hoạt động tiếp theo. Lỗi ghi nhật ký không làm hỏng gửi sự kiện hoặc lưu đáp án.
Kiểm thử MCP cần header `MCP-Protocol-Version: 2026-07-28` và ba trường `_meta`
bắt buộc của MCP 2. Thiếu envelope trả 400 là đúng; SDK hiện tại hỗ trợ phiên bản
này và không cần thay đổi bộ biên dịch giáo trình.

HANEUL_WORKSHEET_PUBLIC_URL là origin HTTPS tùy chọn để hiển thị đúng URL MCP trong
giao diện khi mở Haneul bằng localhost. Đây không phải khóa API. Ví dụ đặt trong
`.env.local`: `HANEUL_WORKSHEET_PUBLIC_URL=https://<tunnel-của-bạn>` rồi khởi động
lại server nếu môi trường triển khai không tự nạp lại env.

## Xác minh

Chạy lint/typecheck/test/build. Test sự kiện kiểm tra callback challenge, chữ ký,
owner isolation, replay ID khi retry, restart/refresh/secret rotation, expiry,
revoke và một vòng job thật trong kho với callback mô phỏng. Script
`node --env-file=.env.local scripts/check-worksheet-flow.mjs` kiểm tra HTTP/MCP
trên bản local với tài khoản tạm, tự dọn dữ liệu. Chỉ sau khi đăng ký ChatGPT thật
và upload một đề thật mới xác minh được vòng AI hoàn chỉnh; test mô phỏng không
chứng minh trạng thái tài khoản ChatGPT của người dùng.

Nguồn chính thức:
[Kết nối plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt),
[MCP Events](https://developers.openai.com/plugins/build/mcp-events).
