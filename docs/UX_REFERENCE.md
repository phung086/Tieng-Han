# UX Direction

## Mục tiêu cảm xúc

Ứng dụng phải tạo cảm giác muốn quay lại học: sáng, ấm, có tiến độ rõ ràng, ít áp lực và không giống một LMS nặng nề.

## Pattern tham khảo

### Duolingo

- Một đường học rõ ràng giúp giảm lựa chọn dư thừa.
- Practice được đặt ngay trong learning path.
- Chia nội dung thành unit nhỏ, luôn có một hành động tiếp theo rõ.

Áp dụng: dashboard luôn có **Tiếp tục học** là CTA chính, lesson list có trạng thái done/current/next/locked.

### LingQ

- Điều hướng gần đây nhấn mạnh recent lessons.
- Review vocabulary phải truy cập nhanh ngay trong ngữ cảnh bài học.
- Reader/lesson nên cho phép hiển thị hỗ trợ theo nhu cầu thay vì nhồi mọi thông tin lên màn hình.

Áp dụng: review riêng nhưng luôn liên kết với lesson; UI ưu tiên contextual actions.

### Figma / learning-dashboard patterns

- Dashboard cá nhân hóa nên trả lời ba câu: đang ở đâu, hôm nay làm gì, điểm yếu nào cần ưu tiên.
- Cards chỉ hữu ích khi dẫn tới một quyết định/hành động.

Áp dụng: bỏ số liệu trang trí; mỗi card đều dẫn tới Learn, Review, Practice hoặc Stats.

## Design principles

1. **One obvious next action** — mỗi màn hình có một CTA chính.
2. **Textbook-first** — unit/lesson là trục điều hướng, không phải feed ngẫu nhiên.
3. **Calm gamification** — streak, XP và celebration có nhưng không gây áp lực.
4. **Korean readability** — font Hàn riêng, line-height thoáng, không dùng chữ Hàn quá nhỏ.
5. **Fast feedback** — quiz phản hồi ngay, giải thích ngắn, không bắt chuyển màn hình.
6. **Mobile-first interactions** — tap target lớn, bottom navigation, card stack tự nhiên.
7. **Desktop density vừa phải** — sidebar cố định nhưng nội dung vẫn tập trung vào một task.
8. **Accessible motion** — transition nhỏ, không animation liên tục gây phân tâm.

## Visual language

- nền warm-neutral thay vì trắng lạnh;
- indigo/violet làm primary để có cá tính nhưng không giống Duolingo;
- accent mint/coral/amber cho từng skill;
- radius lớn, border tinh tế, shadow nhẹ;
- typography mạnh ở title, body trung tính;
- Korean words được dùng như yếu tố nội dung, không phải decoration vô nghĩa.

Không sao chép layout/illustration cụ thể từ sản phẩm tham khảo.
