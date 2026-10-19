# Duyệt nguồn và học có hướng dẫn

Màn “Bài học có hình” dùng chung cho mọi bài, giữ toàn bộ từ và mục ngữ
pháp đã nhập. Một vòng học gợi ý nối nhìn hình → hiểu mẫu → nhập vai/vận
dụng; mọi phần đều mở. Che nghĩa có thể áp dụng cả danh sách rồi hiện từng
từ. Nhập vai chỉ che lời của vai đã chọn, giữ nghĩa Việt làm gợi ý và cho
hiện câu bất cứ lúc nào. Không cần mic, nhập tiếng Hàn, chấm điểm hay hoàn
thành phần trước. Các lựa chọn đọc, nghe, viết, phát âm và hoạt động gốc
được nối từ cuối bài khi có dữ liệu.

## Phân biệt nội dung nguồn và biên soạn

`DialogueItem.origin?: source|derived` và
`translationOrigin?: source|derived` tách xuất xứ lời thoại khỏi bản dịch.
Không suy ra `source` chỉ vì có tên PDF/số trang. Nội dung cũ chưa gắn nhãn
không được tự chứng nhận là nguyên bản. Contract import hướng dẫn kiểm tra
từng lượt lời và giữ ID của mẫu đã tồn tại.

`node scripts/apply-reviewed-dialogues.mjs --data-dir <private-data> --review <review.json>`
chạy kiểm tra trước; thêm `--apply` mới ghi. Manifest version 1 gồm
`courseId`, `fileName`, `originalSha256`, `reviewedBy`, `method`, `lessons`.
Mỗi lesson có `id`, `dialogues`, tùy chọn `derivedIds` để ghi lại nội dung
bổ trợ đã xác định. Mỗi dialogue cần `id`, `title`, `origin:source`,
`translationOrigin`, `pages`, `lines:[{speaker,ko,vi?}]`.

Script đối chiếu SHA-256 của PDF, danh tính trang khôi phục và lời Hàn trên
trang được dẫn; không dùng phép khớp chữ thay cho duyệt PDF. Chặn trang sai,
câu không có trong bằng chứng và mẫu trùng nhưng dùng ID mới. Giữ nguyên
các mục cũ và thứ tự của chúng để bảo toàn mã luyện cũ; sao lưu khóa,
bundle job (nếu có) và khóa đang chọn trước khi
ghi từng file. Không sửa tiến độ người học. Job chưa có resultBundle vẫn
được giữ nguyên.

Màn luyện dịch/nghe cũng hiển thị xuất xứ của hội thoại và bản dịch. Câu
chưa duyệt không được tự gọi là nguyên văn sách; phản hồi chấm dùng “câu
mẫu” vì bài luyện có thể chứa nội dung bổ trợ. Đây vẫn là phép so câu mẫu,
không phải chấm mọi bản dịch đúng nghĩa.

## Kiểm tra toàn thư viện

```powershell
python scripts/audit-source-fidelity.py --data-dir <private-data> --output <private-report.json>
```

Đây là kiểm tra từ nội dung đã biên soạn về trang được dẫn, không phải kiểm
kê ngược mọi đơn vị của sách. Chỉ so chuỗi chữ/số NFKC, bỏ khoảng trắng và
dấu câu. Trang khôi phục phải khớp checksum PDF gốc. Không sửa dữ liệu.
Mục chưa khớp cần đọc PDF: có thể do OCR, bố cục, trang dẫn sai, diễn đạt
lại hoặc nội dung không có trong nguồn. Kiểm tra này không xác nhận nghĩa
Việt, quy tắc ngữ pháp, ảnh, đáp án hay độ bao phủ đầy đủ.

Đối chiếu thư viện private ngày 19/10/2026: 4 khóa, 60 bài; 4.059 đơn vị
đích được kiểm tra, 3.578 khớp chữ trên trang dẫn, 4 được ghi rõ là bổ trợ,
423 cần duyệt và 54 thiếu vị trí trích dẫn. Các con số này không phải tỷ lệ
hoàn thành giáo trình. Toàn bộ khóa vẫn ở trạng thái `partial`.

Lượt duyệt trực tiếp bổ sung 15 mẫu và hoàn thiện nhãn/bản dịch một mẫu đã
có, tổng 16 mẫu/38 lượt lời ở đủ 15 bài Sơ cấp 1. Một hội thoại bổ trợ trước
đó dẫn sai trang được ghi lại đúng tính chất. Bốn ảnh gốc (thư viện, nước
ép, chó/mèo, cà phê) được gắn riêng vào đúng mẫu mới; tổng thư viện hiện có
322 vùng hình đã duyệt. Không có kết luận đã duyệt mọi tranh hay mọi câu
trong bốn sách. PDF, manifest, ảnh và báo cáo chi tiết được giữ private.

Ưu tiên tiếp theo là đọc trực tiếp các mục bị đánh dấu, đặc biệt giáo trình
scan Sơ cấp 2; hoàn thiện kiểm kê bài tập/đáp án và những phần vẫn chỉ có
bản trích xuất. Chưa có file âm thanh CD gốc; giọng đọc máy không được coi
là bản thu của sách.
