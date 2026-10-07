# Haneul Worksheet Translation Fidelity Contract

## Mục tiêu

Contract này áp dụng cho worker xử lý **Haneul Vở bài tập** trước khi gọi
`submit_worksheet`. Mục tiêu ưu tiên là **đúng nội dung của worksheet**, không
phải tạo bản dịch tự nhiên hơn bằng kiến thức ngoài nguồn.

## Thứ tự nguồn sự thật

Khi giải hoặc dịch một worksheet, worker phải dùng thứ tự ưu tiên sau:

1. Ảnh trang worksheet đang xử lý.
2. Tiêu đề/instruction của đúng bài tập trên trang.
3. Bảng **NGỮ PHÁP / TỪ VỰNG / ví dụ** nằm trong chính worksheet.
4. Ngữ cảnh của cùng một đoạn hội thoại.
5. Kiến thức ngôn ngữ chung chỉ dùng khi 1–4 không đủ.

Nếu nguồn trong worksheet dùng một cách dịch hoặc từ vựng khác với cách dịch
thông dụng, **worksheet thắng**. Không tự sửa giáo trình.

## 1. Phân đoạn câu hỏi

- Giữ nguyên thứ tự trang và thứ tự câu.
- Một câu đánh số là một item.
- Một đoạn hội thoại hoàn chỉnh là một item, không tách từng lượt nói thành
  item độc lập nếu worksheet trình bày nó như một bài dịch đoạn.
- Không tạo item từ logo, tiêu đề trang, số trang, ví dụ minh họa, phần NGỮ
  PHÁP hoặc bảng TỪ VỰNG trừ khi đề yêu cầu trực tiếp.
- Không bỏ câu chỉ vì đã có đáp án viết tay cũ trên ảnh.

## 2. Trường `question`

`question` phải là nội dung đề nguồn, không phải bản diễn giải.

Phải giữ:

- tên riêng;
- tên tổ chức;
- số, lớp/năm học;
- quốc tịch;
- nghề nghiệp;
- phủ định/khẳng định;
- dấu hỏi và vai hội thoại A/B hoặc 가/나;
- các lựa chọn đồng nghĩa được đề in ra.

Không được đổi:
- “Đại học Việt Nam” thành “đại học ở Việt Nam”;
- “giáo viên” thành “giảng viên” nếu nguồn không yêu cầu;
- một tên riêng thành tên tương tự.

## 3. Dịch Việt → Hàn

- `answer` chứa câu/đoạn tiếng Hàn hoàn chỉnh.
- Bảo toàn toàn bộ semantic anchors của câu nguồn.
- Có thể lược đại từ chỉ khi tiếng Hàn tự nhiên **và không làm mơ hồ vai hội
  thoại**.
- Trong hội thoại, nếu “bạn” chỉ rõ người đang được hỏi và việc lược chủ thể có
  thể làm mất vai, phải dùng tên + `씨` hoặc chủ thể phù hợp.

Ví dụ:
- “Bạn là bác sĩ à?” trong hội thoại Mary/Chun phải giữ người được hỏi, ví dụ
  `메리 씨는 의사입니까?`.
- “Bạn là họa sĩ phải không?” phải giữ người được hỏi, ví dụ
  `춘 씨는 화가입니까?`.

## 4. Dịch Hàn → Việt

- `answer` chứa bản dịch tiếng Việt.
- Không khái quát hóa danh từ riêng hoặc cụm danh từ.
- Không thêm mức độ trang trọng/chức danh không có trong nguồn.
- Nếu worksheet có bảng từ vựng tương ứng thì dùng đúng nghĩa của bảng đó.

Ví dụ:
- `베트남 대학교 선생님입니까?` phải giữ cụm `베트남 대학교`, không đổi
  thành “giảng viên đại học ở Việt Nam”.
- Nếu bảng từ vựng của trang quy định `경영학과` = “Khoa Kinh doanh”, bản
  dịch trong bài này phải dùng “Khoa Kinh doanh”, không tự đổi thành “Quản trị
  kinh doanh”.

## 5. Glossary lock

Trước khi dịch một trang, worker phải đọc các bảng từ vựng/grammar cùng trang
hoặc trang kế cận thuộc cùng bài.

Tạo một glossary tạm thời và khóa các cặp từ đã được worksheet định nghĩa.

Ví dụ regression Bài 1:

- 친구 → Bạn bè
- 어머니 → Mẹ
- 동생 → Em
- 무역대학교 → Đại học Thương Mại
- 경영학과 → Khoa Kinh doanh
- 화가 → Họa sĩ
- 작곡자 → Nhạc sĩ

Không “chuẩn hóa” `작곡자` sang một từ khác chỉ vì cách dùng ngoài đời có thể
khác. Source worksheet là source of truth.

## 6. Entity lock

Mỗi item phải trích các semantic anchors trước khi dịch:

- PERSON
- COUNTRY/NATIONALITY
- OCCUPATION
- ORGANIZATION/SCHOOL/HOSPITAL/BANK
- NUMBER/YEAR
- POLARITY
- SPEAKER/ADDRESSEE

Sau khi dịch, kiểm tra từng anchor còn tồn tại với cùng nghĩa.

Ví dụ:
- TPBANK phải còn là TPBANK.
- Lee Yoo Na phải còn đúng người/tên.
- “năm 3” phải còn là năm 3.
- “không” không được biến thành khẳng định.
- “bạn” trong hội thoại không được biến mất nếu làm mất người được hỏi.

## 7. Không diễn giải vượt nguồn

Không:
- viết lại cho “hay hơn”;
- giải thích thêm;
- suy đoán tên trường/tổ chức;
- đổi nghề nghiệp sang từ chuyên môn hơn;
- dùng kiến thức ngoài worksheet để sửa nội dung.

Nếu ảnh mờ hoặc không chắc một token, giữ item nhưng thêm `warning`; không
đoán.

## 8. Mapping vào `submit_worksheet`

### Bài dịch

- `question`: nguyên văn nội dung cần dịch.
- `instruction`: nguyên văn/chuẩn hóa ngắn gọn của heading, ví dụ
  “Dịch câu Việt Hàn”.
- `answer`: bản dịch đích.
- `translation`: để trống, trừ khi UI cụ thể yêu cầu hiển thị thêm nghĩa.
- `warning`: chỉ dùng khi có điểm mờ/không chắc.

### Bài điền/hoàn thành câu

- `answer`: câu Hàn hoàn chỉnh.
- `translation`: nghĩa Việt nếu có ích cho review.

## 9. QA bắt buộc trước khi submit

Worker phải chạy checklist cho từng item:

1. Đúng page.
2. Đúng instruction/direction.
3. Question không bị viết lại.
4. Tất cả tên riêng còn nguyên.
5. Quốc tịch/nghề nghiệp/tổ chức còn nguyên nghĩa.
6. Phủ định/khẳng định không đổi.
7. Số/năm học không đổi.
8. Glossary của worksheet được ưu tiên.
9. Vai hội thoại không bị mất.
10. Không có nội dung do model tự thêm.

Nếu một mục thất bại, sửa answer trước khi gọi `submit_worksheet`.

## 10. Regression bắt buộc

Bài 1 “Giới thiệu (소개)” là fixture regression tối thiểu. Worker phải qua các
case trong `docs/WORKSHEET_BAI_1_REGRESSION.md` trước khi coi thay đổi
translation prompt/worker là an toàn.
