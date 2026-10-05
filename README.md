# Tiếng Hàn

Ứng dụng cá nhân để học và ôn luyện tiếng Hàn bám sát giáo trình: **Từ vựng · Ngữ pháp · Nghe · Nói · Đọc · Viết**.

## Triết lý hiện tại

Dự án ưu tiên **local-first** và trải nghiệm học tập:

- chạy bằng một app Next.js duy nhất;
- không cần Docker, backend riêng hay database server ở giai đoạn đầu;
- UI/UX được xây trước bằng dữ liệu mẫu để chốt luồng học;
- dữ liệu giáo trình sẽ được đưa vào local storage/SQLite ở phase tiếp theo;
- khi cần production có thể đóng gói app + SQLite persistent volume, không phải tách microservice.

## Chạy local

Yêu cầu Node.js 22+ và pnpm.

```bash
corepack enable
pnpm install
pnpm dev
```

Mở http://localhost:3000.

## Kiểm tra project

```bash
pnpm check
```

## Các màn hình base

- Dashboard cá nhân
- Học theo giáo trình
- Practice / quiz tương tác
- Ôn tập
- Thống kê

## Cấu trúc

```text
src/
  app/          routes
  components/   UI dùng chung
  data/         dữ liệu demo / seed trước khi nhập giáo trình thật
docs/
  ARCHITECTURE.md
  UX_REFERENCE.md
```

Mọi nội dung thật sau này phải truy được về: `Course -> Book -> Unit -> Section -> sourceRef`.
