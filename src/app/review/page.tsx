"use client";

import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3 } from "lucide-react";
import { course, studyQuestions } from "@/data/content";
import { todayKey, useLearning } from "@/lib/learning-state";

type ReviewDisplay = {
  id: string;
  title: string;
  subtitle: string;
  lessonId: number;
  strength: number;
  dueAt: string;
  href: string;
};

export default function ReviewPage() {
  const { state } = useLearning();
  const today = todayKey();

  const vocabCatalog = course.lessons.flatMap((lesson) =>
    lesson.vocabulary.map((item) => ({
      id: item.id,
      title: item.ko,
      subtitle: item.vi,
      lessonId: lesson.id,
      href: "/vocabulary?lesson=" + lesson.id,
    })),
  );

  const questionCatalog = studyQuestions.map((item) => ({
    id: item.id,
    title: item.prompt,
    subtitle: item.skill === "grammar" ? "Ngữ pháp" : item.skill === "reading" ? "Đọc" : item.skill === "writing" ? "Viết" : "Từ vựng",
    lessonId: item.lessonId,
    href: "/practice/quiz?lesson=" + item.lessonId,
  }));

  const catalog = [...vocabCatalog, ...questionCatalog];
  const queue: ReviewDisplay[] = catalog
    .map((item) => {
      const mastery = state.mastery[item.id];
      return mastery ? { ...item, strength: mastery.strength, dueAt: mastery.dueAt } : null;
    })
    .filter((item): item is ReviewDisplay => Boolean(item && item.dueAt <= today))
    .sort((a, b) => a.strength - b.strength);

  const weak = catalog
    .map((item) => {
      const mastery = state.mastery[item.id];
      return mastery ? { ...item, strength: mastery.strength, dueAt: mastery.dueAt } : null;
    })
    .filter((item): item is ReviewDisplay => Boolean(item))
    .sort((a, b) => a.strength - b.strength)
    .slice(0, 8);

  return (
    <div className="page">
      <header className="page-header compact">
        <div><span className="kicker">ÔN TẬP · 복습</span><h1>Ôn đúng thứ sắp quên</h1><p>Hàng đợi được tạo từ kết quả thật: trả lời sai làm mức nhớ giảm, trả lời đúng sẽ giãn ngày ôn tiếp theo.</p></div>
      </header>

      <section className="review-summary">
        <div className="review-hero-icon">{queue.length ? <Brain size={28} /> : <CheckCircle2 size={28} />}</div>
        <div>
          <span className="eyebrow">{queue.length ? "ĐẾN HẠN HÔM NAY" : "HÀNG ĐỢI SẠCH"}</span>
          <h2>{queue.length ? queue.length + " mục cần ôn" : "Không có mục nào quá hạn"}</h2>
          <p>{queue.length ? "Bắt đầu từ mục yếu nhất trước." : "Bạn có thể học tiếp bài mới hoặc luyện tự do."}</p>
        </div>
        <Link className="primary-button" href={queue[0]?.href ?? "/practice"}>{queue.length ? "Bắt đầu ôn" : "Luyện tự do"} <ArrowRight size={18} /></Link>
      </section>

      <section className="review-list-card">
        <div className="section-title-row"><div><span className="eyebrow">{queue.length ? "Đến hạn" : "Điểm yếu gần đây"}</span><h2>{queue.length ? "Ưu tiên theo độ nhớ" : "Theo dõi để ôn đúng lúc"}</h2></div></div>
        {(queue.length ? queue : weak).length ? (
          <div className="vocab-list">
            {(queue.length ? queue : weak).map((item) => (
              <Link className="vocab-row review-link-row" href={item.href} key={item.id}>
                <div className="vocab-main"><strong className="korean-text">{item.title}</strong><span>{item.subtitle} · Bài {item.lessonId}</span></div>
                <div className="memory-cell"><div className="memory-track"><span style={{ width: item.strength + "%" }} /></div><span>{item.strength}% nhớ</span></div>
                <div className="due-cell"><Clock3 size={15} /> {item.dueAt <= today ? "Đến hạn" : item.dueAt}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="review-empty"><CheckCircle2 size={24} /><div><strong>Chưa có dữ liệu ôn tập.</strong><p>Học Flashcard hoặc làm Quiz một lần, hệ thống sẽ bắt đầu xây hàng đợi cho bạn.</p></div></div>
        )}
      </section>
    </div>
  );
}
