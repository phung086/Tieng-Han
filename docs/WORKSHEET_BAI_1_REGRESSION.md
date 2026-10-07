# Worksheet Regression — Bài 1: Giới thiệu (소개)

Nguồn regression: worksheet Bài 1 do người dùng cung cấp và bản PDF Haneul đã
trả về. Fixture này dùng để bắt các lỗi dịch đúng nghĩa nhưng sai **fidelity**
với worksheet.

## Kết quả đối chiếu bản Haneul hiện tại

### Lỗi 1 — glossary drift

Nguồn Hàn:
`제 동생은 무역대학교 경영학과 3학년입니다.`

Bản Haneul đã trả:
> Em tôi là sinh viên năm ba khoa Quản trị kinh doanh, Trường Đại học Thương mại.

Vấn đề:
- worksheet định nghĩa `경영학과` = **Khoa Kinh doanh**;
- worker tự thay bằng “Quản trị kinh doanh”.

Expected:
> Em tôi là sinh viên năm 3 khoa Kinh doanh, Đại học Thương Mại.

### Lỗi 2 — generalize named noun phrase

Nguồn Hàn:
`베트남 대학교 선생님입니까?`

Bản Haneul đã trả:
> Anh/chị có phải là giảng viên đại học ở Việt Nam không?

Vấn đề:
- `베트남 대학교` bị đổi từ một cụm danh từ thành địa điểm chung
  “đại học ở Việt Nam”;
- `선생님` bị nâng thành “giảng viên” dù nguồn không yêu cầu.

Expected:
> Anh/chị có phải là giáo viên của Đại học Việt Nam không?

### Lỗi 3 — mất addressee trong hội thoại

Nguồn Việt:
> Vâng. Tôi là người Nhật Bản. Bạn là bác sĩ à?

Bản Haneul:
`네, 저는 일본 사람입니다. 의사입니까?`

Vấn đề:
- phần “bạn” bị lược;
- trong dialogue có hai nhân vật, việc lược chủ thể làm mất anchor người được
  hỏi.

Expected:
`네, 저는 일본 사람입니다. 메리 씨는 의사입니까?`

### Lỗi 4 — mất addressee lần hai

Nguồn Việt:
> Vâng. Bạn là họa sĩ phải không?

Bản Haneul:
`네. 화가입니까?`

Expected:
`네. 춘 씨는 화가입니까?`

## Expected answers đầy đủ

### 1. Dịch câu Việt → Hàn

1. `호아 씨는 베트남 사람입니다.`
2. `제 선생님은 중국 사람입니다.`
3. `제 친구는 의사입니다.`
4. `제 선생님의 이름은 이유나입니다.`
5. `어머니는 주부입니까?`

### 2. Dịch câu Hàn → Việt

6. Nam là giáo viên tiếng Anh.
7. Ông tôi là người Nhật Bản.
8. Tôi là Mei.
9. Em tôi là sinh viên năm 3 khoa Kinh doanh, Đại học Thương Mại.
10. Người này là nhân viên ngân hàng TPBANK.

### 3. Dịch đoạn hội thoại Việt → Hàn

11.

```text
A: 안녕하세요? 제 이름은 메리입니다.
B: 만나서 반갑습니다. 저는 춘입니다.
A: 메리 씨는 영국 사람입니까?
B: 아니요, 저는 프랑스 사람입니다.
A: 춘 씨는 일본 사람입니까?
B: 네, 저는 일본 사람입니다. 메리 씨는 의사입니까?
A: 네. 춘 씨는 화가입니까?
B: 아니요, 저는 작곡자입니다.
```

Lưu ý: giữ `작곡자` vì bảng từ vựng của worksheet đang gán từ này cho
“Nhạc sĩ”. Không tự sửa nguồn thành một từ Hàn khác.

### 4. Dịch đoạn hội thoại Hàn → Việt

12.

```text
A: Xin chào. Xin hỏi, anh/chị có phải là Arika không?
B: Vâng, tôi là Arika.
A: Anh/chị có phải là giáo viên của Đại học Việt Nam không?
B: Không, tôi là bác sĩ của Bệnh viện Bạch Mai.
```

## Acceptance gate

Một worker/prompt mới chỉ đạt regression khi:

- đủ 12 item theo đúng thứ tự;
- item 11 và 12 giữ nguyên toàn bộ lượt thoại;
- item 9 dùng “Khoa Kinh doanh” theo glossary của worksheet;
- item 12 không biến `베트남 대학교` thành “đại học ở Việt Nam”;
- item 11 giữ rõ Mary/Chun ở hai câu hỏi nghề nghiệp;
- không tạo thêm item từ phần NGỮ PHÁP/TỪ VỰNG;
- không tự sửa `작곡자` bằng kiến thức ngoài worksheet.
