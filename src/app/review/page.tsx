"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";
import { formatReviewDate, reviewHref, reviewSummary, skillNames } from "@/lib/review-plan";
import { EmptyCourseState } from "@/components/empty-course-state";

export default function ReviewPage() {
  const { state } = useLearning();
  const { course } = useContent();
  const [filter, setFilter] = useState<"due" | "weak" | "all">("due");
  const today = todayKey();
  if (!course.lessons.length) return <div className="page"><EmptyCourseState /></div>;
  const { learned, due, weak, nextDue } = reviewSummary(course, state, today);
  const visible = (filter === "due" ? due : filter === "weak" ? weak : learned).slice(0, 50);
  const strongCount = learned.filter(item => item.strength >= 80).length;

  return <div className="page review-v4">
    <header className="review-head-v4">
      <div><h1>Ôn đúng lúc, nhớ vững hơn.</h1><p>{course.title} · Lịch ôn riêng cho những mục bạn đã học.</p></div>
      <div className="review-head-stats-v4"><span><Clock3 size={17} />{due.length} đến hạn</span><span><Brain size={17} />{weak.length} cần củng cố</span></div>
    </header>

    <section className={"review-focus-card-v4 " + (due.length ? "due" : "clean")}>
      <div className="review-focus-icon-v4">{due.length ? <Brain size={30} /> : <CheckCircle2 size={30} />}</div>
      <div><h2>{due.length ? `${due.length} mục đến hạn hôm nay` : learned.length ? "Bạn đã ôn đủ cho hôm nay." : "Lịch ôn bắt đầu từ bài đầu tiên."}</h2>
        <p>{due.length ? "Ôn tối đa 10 mục mỗi phiên. Mục quá hạn được ưu tiên, mỗi câu trả lời cập nhật đúng lịch của mục đó." : nextDue ? `Lần ôn tiếp theo: ${formatReviewDate(nextDue)}. Bạn có thể học tiếp hoặc củng cố mục còn yếu.` : "Học từ vựng và làm bài luyện để tạo lịch ôn. Chỉ những mục đã học mới vào hàng đợi."}</p>
      </div>
      <Link className="primary-button" href={due.length ? reviewHref() : "/learn"}>{due.length ? "Bắt đầu ôn" : "Tiếp tục học"}<ArrowRight size={18} /></Link>
    </section>

    <section className="review-metrics-v4" aria-label="Tổng quan ôn tập">
      <article><span className="review-metric-icon-v4 purple"><Sparkles size={19} /></span><div><strong>{learned.length}</strong><small>Mục đã học</small></div></article>
      <article><span className="review-metric-icon-v4 rose"><Brain size={19} /></span><div><strong>{weak.length}</strong><small>Cần củng cố</small></div></article>
      <article><span className="review-metric-icon-v4 mint"><ShieldCheck size={19} /></span><div><strong>{strongCount}</strong><small>Đã khá vững</small></div></article>
    </section>

    <section className="review-list-card review-list-card-v4">
      <div className="section-title-row"><h2>Nội dung ôn tập</h2><Link href="/practice">Luyện tập <ArrowRight size={15} /></Link></div>
      <div className="review-filters" role="group" aria-label="Lọc nội dung ôn tập">
        {([['due', 'Đến hạn', due.length], ['weak', 'Cần củng cố', weak.length], ['all', 'Đã học', learned.length]] as const).map(([value, label, count]) =>
          <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>)}
      </div>
      {visible.length ? <div className="review-stack-v4">{visible.map(item => <Link className="review-item-v4" href={reviewHref(item.id)} key={item.id}>
        <span className="review-rank-v4"><Brain size={18} /></span>
        <div className="review-item-main-v4"><strong className="korean-text">{item.audioText ?? item.prompt}</strong><span>{skillNames[item.skill]} · Bài {item.lessonId}{item.reviewKind ? " · Tự đánh giá" : ""}</span>
          <div className="memory-track" aria-label={`Độ vững ${item.strength}%`}><span style={{ width: item.strength + "%" }} /></div>
        </div>
        <div className="review-strength-v4"><strong>{item.strength}%</strong><span>{item.dueAt < today ? "Quá hạn" : item.dueAt === today ? "Hôm nay" : formatReviewDate(item.dueAt)}</span></div><ArrowRight size={17} />
      </Link>)}</div> : <div className="review-empty review-empty-v4"><CheckCircle2 size={24} /><div>
        <strong>{filter === "due" && learned.length ? "Không có mục đến hạn." : filter === "weak" && learned.length ? "Chưa có mục cần củng cố." : "Chưa có dữ liệu ôn tập."}</strong>
        <p>{learned.length ? "Chọn Đã học để xem lịch từng mục, hoặc tiếp tục bài học của bạn." : "Bắt đầu một chặng học. Haneul sẽ ghi nhớ mục đã làm và lên lịch ôn cho bạn."}</p>
      </div></div>}
      {visible.length === 50 ? <p className="review-method">Đang hiển thị 50 mục đầu tiên. Phiên ôn sẽ tiếp tục chọn các mục đến hạn còn lại.</p> : null}
      <p className="review-method">Lịch ôn dùng kết quả trả lời để giãn khoảng cách 1, 3, 7, 14 hoặc 30 ngày. Câu sai quay lại hôm nay; làm đúng lặp lại trong cùng ngày không tự nâng độ vững.</p>
    </section>
  </div>;
}
