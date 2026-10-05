import Link from "next/link";
import { ArrowRight, Brain, Clock3 } from "lucide-react";
import { reviewWords } from "@/data/demo";

export default function ReviewPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div><span className="kicker">ÔN TẬP · 복습</span><h1>Những gì cần nhớ lại hôm nay</h1><p>Ưu tiên nội dung yếu và sắp quên, thay vì bắt bạn làm lại tất cả.</p></div>
      </header>

      <section className="review-summary">
        <div className="review-hero-icon"><Brain size={28} /></div>
        <div><span className="eyebrow">Phiên đề xuất</span><h2>12 mục · khoảng 8 phút</h2><p>Flashcard và quiz dùng lại đúng những dạng bài đã có trong hệ thống.</p></div>
        <Link className="primary-button" href="/vocabulary">Bắt đầu ôn <ArrowRight size={18} /></Link>
      </section>

      <section className="review-list-card">
        <div className="section-title-row"><div><span className="eyebrow">Từ cần ôn</span><h2>Ưu tiên theo độ nhớ</h2></div><Link href="/practice/quiz">Luyện tổng hợp <ArrowRight size={16} /></Link></div>
        <div className="vocab-list">
          {reviewWords.map((word) => (
            <div className="vocab-row" key={word.ko}>
              <div className="vocab-main"><strong>{word.ko}</strong><span>{word.vi}</span></div>
              <div className="memory-cell"><div className="memory-track"><span style={{ width: word.strength + "%" }} /></div><span>{word.strength}% nhớ</span></div>
              <div className="due-cell"><Clock3 size={15} /> {word.due}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
