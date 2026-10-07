# Tiếng Hàn

Nền tảng học tiếng Hàn **source-grounded**, bám sát giáo trình dành cho người Việt Nam.

## Curriculum đã tích hợp

- Hangeul nhập môn
- Sơ cấp 1: 15 bài
- Sơ cấp 2: 15 bài
- Sơ cấp Mastery: review tổng hợp
- Trung cấp 3: 15 bài
- Nâng cao: chờ nguồn mới, không hard-code kiến thức

Dữ liệu nằm trong `curriculum/`:

- `curriculum.json`: lộ trình, stage, unit, lesson flow
- `sources.json`: catalog tài liệu nguồn
- `workflow.json`: ingestion, review, mastery, quy tắc question engine

## Nguyên tắc

1. Mọi câu hỏi phải có `sourceEvidence`.
2. Không sinh kiến thức ngoài syllabus đã mở khóa.
3. Workbook/ngân hàng dịch là nguồn bổ trợ, không thay giáo trình chính.
4. PDF/scan có bản quyền **không được commit vào repo công khai**; khi triển khai đặt file nguồn cục bộ và chạy pipeline import.
5. Kiến trúc curriculum là data-driven để sau này mở rộng tiếng Anh/Trung mà không hard-code.

## Clone

```bash
git clone https://github.com/phung086/Tieng-Han.git
cd Tieng-Han
```

## Trạng thái ứng dụng

Haneul hiện đã có:

- multi-course Course Library, tìm kiếm/lọc theo cấp độ;
- flow học 6 kỹ năng + Mastery Check, Practice Hub và Memory Garden;
- tiến độ/XP/mastery theo từng giáo trình;
- PostgreSQL authentication, learner/admin roles và server-side sessions;
- profile, đổi mật khẩu và quản lý thiết bị đăng nhập;
- admin course publishing, user access controls và audit trail;
- PDF import -> MCP Events -> ChatGPT checkpoints -> finalized Course Bundle;
- Playwright smoke tests trên desktop và mobile ngoài lint/typecheck/unit/build.

Xem `docs/ARCHITECTURE.md`, `docs/LEARNER_MVP_BASELINE.md` và
`docs/PHASE_SCALE_1_SETUP.md` để hiểu boundary hiện tại.


## Hướng dẫn nhập sách tự động

Xem `docs/AUTO_IMPORT_GUIDE.md` để cấu hình và vận hành luồng PDF -> MCP -> ChatGPT Work -> checkpoint -> course hoàn chỉnh.
