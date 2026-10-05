import Link from "next/link";
import { BookOpenText } from "lucide-react";

export function EmptySkillState({
  lessonId,
  skill,
}: {
  lessonId: number;
  skill: string;
}) {
  return (
    <div className="empty-skill-state">
      <div className="empty-skill-icon"><BookOpenText size={28} /></div>
      <span className="eyebrow">CHƯA CÓ DỮ LIỆU</span>
      <h1>{skill} · Bài {lessonId}</h1>
      <p>Workflow của phần này đã sẵn sàng. Khi nhập giáo trình, nội dung của bài sẽ xuất hiện tại đây mà không cần đổi giao diện.</p>
      <Link className="secondary-button" href={"/learn/" + lessonId}>Quay lại bài học</Link>
    </div>
  );
}
