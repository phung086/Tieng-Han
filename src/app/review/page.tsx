"use client";

import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";

type ReviewCatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  lessonId: number;
  href: string;
};

type ReviewDisplay = ReviewCatalogItem & {
  strength: number;
  dueAt: string;
};

function uniqueCatalog(items: ReviewCatalogItem[]) {
  const map = new Map<string, ReviewCatalogItem>();

  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }

  return [...map.values()];
}

export default function ReviewPage() {
  const { state } = useLearning();
  const { course } = useContent();
  const today = todayKey();

  const textbookCatalog = course.lessons.flatMap((lesson): ReviewCatalogItem[] => {
    const vocabulary = lesson.vocabulary.map((item) => ({
      id: item.id,
      title: item.ko,
      subtitle: "Từ vựng · " + item.vi,
      lessonId: lesson.id,
      href: "/vocabulary?lesson=" + lesson.id,
    }));

    const listening = lesson.listening.map((item) => ({
      id: item.id,
      title: item.text,
      subtitle: "Nghe · " + item.meaning,
      lessonId: lesson.id,
      href: "/listening?lesson=" + lesson.id,
    }));

    const speaking = lesson.speaking.map((sentence, index) => ({
      id: "speak-" + lesson.id + "-" + index,
      title: sentence,
      subtitle: "Nói · Shadowing",
      lessonId: lesson.id,
      href: "/speaking?lesson=" + lesson.id,
    }));

    const reading =
      lesson.reading?.questions.map((item) => ({
        id: item.id,
        title: item.q,
        subtitle: "Đọc hiểu",
        lessonId: lesson.id,
        href: "/reading?lesson=" + lesson.id,
      })) ?? [];

    const writing = lesson.writing
      ? [{
          id: "writing-" + lesson.id,
          title: lesson.writing.prompt,
          subtitle: "Viết",
          lessonId: lesson.id,
          href: "/writing?lesson=" + lesson.id,
        }]
      : [];

    return [...vocabulary, ...listening, ...speaking, ...reading, ...writing];
  });

  const questionCatalog: ReviewCatalogItem[] = course.questions.map((item) => ({
    id: item.id,
    title: item.prompt,
    subtitle:
      item.skill === "grammar"
        ? "Ngữ pháp"
        : item.skill === "reading"
          ? "Đọc"
          : item.skill === "writing"
            ? "Viết"
            : item.skill === "listening"
              ? "Nghe"
              : item.skill === "speaking"
                ? "Nói"
                : "Từ vựng",
    lessonId: item.lessonId,
    href: "/practice/quiz?lesson=" + item.lessonId,
  }));

  const catalog = uniqueCatalog([...textbookCatalog, ...questionCatalog]);

  const mastered: ReviewDisplay[] = catalog
    .map((item) => {
      const mastery = state.mastery[item.id];
      return mastery
        ? {
            ...item,
            strength: mastery.strength,
            dueAt: mastery.dueAt,
          }
        : null;
    })
    .filter((item): item is ReviewDisplay => Boolean(item));

  const queue = mastered
    .filter((item) => item.dueAt <= today)
    .sort((a, b) => a.strength - b.strength);

  const weak = [...mastered]
    .sort((a, b) => a.strength - b.strength)
    .slice(0, 8);

  const visible = queue.length ? queue : weak;

  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">ÔN TẬP · 복습</span>
          <h1>Ôn đúng thứ sắp quên</h1>
          <p>
            Từ vựng, Nghe, Nói, Đọc, Viết và Quiz đều dùng chung mastery.
            Sai ở kỹ năng nào sẽ quay lại đúng màn luyện của kỹ năng đó.
          </p>
        </div>
      </header>

      <section className="review-summary">
        <div className="review-hero-icon">
          {queue.length ? <Brain size={28} /> : <CheckCircle2 size={28} />}
        </div>
        <div>
          <span className="eyebrow">
            {queue.length ? "ĐẾN HẠN HÔM NAY" : "HÀNG ĐỢI SẠCH"}
          </span>
          <h2>
            {queue.length
              ? queue.length + " mục cần ôn"
              : "Không có mục nào quá hạn"}
          </h2>
          <p>
            {queue.length
              ? "Bắt đầu từ mục yếu nhất trước."
              : mastered.length
                ? "Các mục đã học đang chờ đúng ngày để quay lại."
                : "Học một phiên để hệ thống bắt đầu xây lịch ôn."}
          </p>
        </div>
        <Link
          className="primary-button"
          href={queue[0]?.href ?? weak[0]?.href ?? "/practice"}
        >
          {queue.length ? "Bắt đầu ôn" : "Luyện tự do"} <ArrowRight size={18} />
        </Link>
      </section>

      <section className="review-list-card">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">
              {queue.length ? "Đến hạn" : "Điểm yếu gần đây"}
            </span>
            <h2>
              {queue.length
                ? "Ưu tiên theo độ nhớ"
                : "Theo dõi để ôn đúng lúc"}
            </h2>
          </div>
        </div>

        {visible.length ? (
          <div className="vocab-list">
            {visible.map((item) => (
              <Link
                className="vocab-row review-link-row"
                href={item.href}
                key={item.id}
              >
                <div className="vocab-main">
                  <strong className="korean-text">{item.title}</strong>
                  <span>{item.subtitle} · Bài {item.lessonId}</span>
                </div>
                <div className="memory-cell">
                  <div className="memory-track">
                    <span style={{ width: item.strength + "%" }} />
                  </div>
                  <span>{item.strength}% nhớ</span>
                </div>
                <div className="due-cell">
                  <Clock3 size={15} />
                  {item.dueAt <= today ? "Đến hạn" : item.dueAt}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="review-empty">
            <CheckCircle2 size={24} />
            <div>
              <strong>Chưa có dữ liệu ôn tập.</strong>
              <p>
                Học Flashcard, Nghe, Nói, Đọc, Viết hoặc Quiz một lần,
                hệ thống sẽ bắt đầu xây hàng đợi cho bạn.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
