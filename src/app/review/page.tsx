import { ArrowRight, Brain, Clock3 } from "lucide-react";
import { reviewWords } from "@/data/demo";

export default function ReviewPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">ÔN TẬP · 복습</span>
          <h1>Những gì cần nhớ lại hôm nay</h1>
          <p>Ưu tiên nội dung yếu và sắp quên, thay vì bắt bạn làm lại tất cả.</p>
        </div>
      </header>

      <section className="review-summary">
        <div className="review-hero-icon"><Brain size={28} /></div>
        <div>
          <span className="eyebrow">Phiên đề xuất</span>
          <h2>12 mục · khoảng 8 phút</h2>
          <p>8 từ vựng, 2 điểm ngữ pháp và 2 câu nghe từ các bài bạn đã học.</p>
        </div>
        <button className="primary-button">Bắt đầu ôn <ArrowRight size={18} /></button>
      </section>

      <section className="review-list-card">
        <div className="section-title-row">
          <div><span className="eyebrow">Từ cần ôn</span><h2>Ưu tiên theo độ nhớ</h2></div>
        </div>
        <div className="vocab-list">
          {reviewWords.map((word) => (
            <div className="vocab-row" key={word.ko}>
              <div className="vocab-main"><strong>{word.ko}</strong><span>{word.vi}</span></div>
              <div className="memory-cell">
                <div className="memory-track"><span style={{ width: `${word.strength}%` }} /></div>
                <span>{word.strength}% nhớ</span>
              </div>
              <div className="due-cell"><Clock3 size={15} /> {word.due}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
