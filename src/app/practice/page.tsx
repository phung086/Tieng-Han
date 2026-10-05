import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, Headphones, Layers3, Mic2, PenLine, Sparkles } from "lucide-react";

const modes = [
  { href: "/practice/quiz", title: "Luyện tổng hợp", ko: "종합 연습", desc: "Trộn từ vựng, ngữ pháp, đọc và viết theo Bài 3.", icon: Sparkles, tone: "violet" },
  { href: "/vocabulary", title: "Flashcard từ vựng", ko: "어휘", desc: "Lật thẻ, nghe phát âm và tự đánh giá độ nhớ.", icon: Layers3, tone: "blue" },
  { href: "/listening", title: "Luyện nghe", ko: "듣기", desc: "Nghe TTS tiếng Hàn, chọn ý nghĩa và nghe lại chậm.", icon: Headphones, tone: "mint" },
  { href: "/speaking", title: "Luyện nói", ko: "말하기", desc: "Shadowing và nhận dạng giọng nói ngay trong trình duyệt.", icon: Mic2, tone: "coral" },
  { href: "/reading", title: "Đọc hiểu", ko: "읽기", desc: "Đọc đoạn ngắn, ẩn nghĩa và trả lời câu hỏi.", icon: BookOpenText, tone: "amber" },
  { href: "/writing", title: "Luyện viết", ko: "쓰기", desc: "Viết theo đề và tự chấm bằng rubric local.", icon: PenLine, tone: "rose" },
];

export default function PracticePage() {
  return (
    <div className="page">
      <header className="page-header compact"><div><span className="kicker">LUYỆN TẬP · 연습</span><h1>Chọn đúng thứ bạn muốn luyện</h1><p>Mỗi mode dùng cùng tiến độ local, nên kết quả sẽ phản ánh trong Review và Stats.</p></div></header>
      <section className="practice-feature">
        <div><span className="pill pill-soft">Đề xuất hôm nay</span><h2>Phiên tổng hợp Bài 3 · 6 câu</h2><p>Bắt đầu từ câu dễ rồi chuyển dần sang điền từ và sắp xếp câu.</p><Link className="primary-button" href="/practice/quiz">Bắt đầu 8 phút <ArrowRight size={18} /></Link></div>
        <div className="practice-brain"><Brain size={48} /></div>
      </section>
      <section className="practice-mode-grid">
        {modes.map(({ href, title, ko, desc, icon: Icon, tone }) => (
          <Link className={"practice-mode tone-" + tone} href={href} key={href}>
            <div className="practice-mode-icon"><Icon size={23} /></div><span>{ko}</span><h2>{title}</h2><p>{desc}</p><div className="mode-arrow"><ArrowRight size={17} /></div>
          </Link>
        ))}
      </section>
    </div>
  );
}
