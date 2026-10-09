"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { ActiveCourseChip } from "@/components/active-course-chip";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";
import { buildLessonPracticeBank } from "@/lib/lesson-practice-bank";

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
  const messages = useMessages();
  const today = todayKey();

  const textbookCatalog = course.lessons.flatMap((lesson): ReviewCatalogItem[] => {
    const vocabulary = lesson.vocabulary.map((item) => ({
      id: item.id,
      title: item.ko,
      subtitle: messages.review.labels.vocabulary + " · " + item.vi,
      lessonId: lesson.id,
      href: "/vocabulary?lesson=" + lesson.id,
    }));

    const listening = lesson.listening.map((item) => ({
      id: item.id,
      title: item.text,
      subtitle: messages.review.labels.listening + " · " + item.meaning,
      lessonId: lesson.id,
      href: "/listening?lesson=" + lesson.id,
    }));

    const speaking = lesson.speaking.map((sentence, index) => ({
      id: "speak-" + lesson.id + "-" + index,
      title: sentence,
      subtitle:
        messages.review.labels.speaking +
        " · " +
        messages.review.labels.shadowing,
      lessonId: lesson.id,
      href: "/speaking?lesson=" + lesson.id,
    }));

    const reading =
      lesson.reading?.questions.map((item) => ({
        id: item.id,
        title: item.q,
        subtitle: messages.review.labels.reading,
        lessonId: lesson.id,
        href: "/reading?lesson=" + lesson.id,
      })) ?? [];

    const writing = lesson.writing
      ? [
          {
            id: "writing-" + lesson.id,
            title: lesson.writing.prompt,
            subtitle: messages.review.labels.writing,
            lessonId: lesson.id,
            href: "/writing?lesson=" + lesson.id,
          },
        ]
      : [];

    return [...vocabulary, ...listening, ...speaking, ...reading, ...writing];
  });

  const practiceQuestions = course.lessons.flatMap(
    (lesson) => buildLessonPracticeBank(lesson, course.questions),
  );
  const questionCatalog: ReviewCatalogItem[] = practiceQuestions.map((item) => ({
    id: item.id,
    title: item.prompt,
    subtitle:
      item.skill === "grammar"
        ? messages.review.labels.grammar
        : item.skill === "reading"
          ? messages.review.labels.reading
          : item.skill === "writing"
            ? messages.review.labels.writing
            : item.skill === "listening"
              ? messages.review.labels.listening
              : item.skill === "speaking"
                ? messages.review.labels.speaking
                : messages.review.labels.vocabulary,
    lessonId: item.lessonId,
    href:
      "/practice/quiz?lesson=" +
      item.lessonId +
      "&mode=guided",
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
  const weakCount = mastered.filter((item) => item.strength < 50).length;
  const strongCount = mastered.filter((item) => item.strength >= 80).length;
  const averageStrength = mastered.length
    ? Math.round(
        mastered.reduce((sum, item) => sum + item.strength, 0) /
          mastered.length,
      )
    : 0;

  return (
    <div className="page review-v4">
      <header className="review-head-v4">
        <div>
          <span className="experience-kicker">MEMORY GARDEN</span>
          <h1>Ôn ít hơn, nhớ lâu hơn.</h1>
          <p>
            Haneul đưa đúng điểm yếu quay lại đúng lúc, thay vì bắt bạn học lại cả bài.
          </p>
          <ActiveCourseChip compact />
        </div>

        <div className="review-head-stats-v4">
          <span><Clock3 size={17} /> {queue.length} đến hạn</span>
          <span><Target size={17} /> {averageStrength}% trí nhớ</span>
          <span><Flame size={17} /> {state.streak} ngày</span>
        </div>
      </header>

      <section
        className={
          queue.length
            ? "review-focus-card-v4 due"
            : "review-focus-card-v4 clean"
        }
      >
        <div className="review-focus-icon-v4">
          {queue.length ? <Brain size={30} /> : <CheckCircle2 size={30} />}
        </div>
        <div>
          <span className="experience-kicker">
            {queue.length ? "SMART REVIEW" : "QUEUE CLEAN"}
          </span>
          <h2>
            {queue.length
              ? queue.length + " mục nên ôn hôm nay"
              : "Hôm nay chưa có mục nào bắt buộc"}
          </h2>
          <p>
            {queue.length
              ? "Bắt đầu từ mục yếu nhất. Mỗi câu trả lời sẽ tự điều chỉnh lần ôn tiếp theo."
              : "Bạn có thể nghỉ, luyện tự do hoặc làm Quick 5 để giữ nhịp."}
          </p>
        </div>
        <Link
          className="primary-button"
          href={queue[0]?.href ?? weak[0]?.href ?? "/practice"}
        >
          {queue.length ? "Bắt đầu ôn" : "Luyện tự do"}
          <ArrowRight size={18} />
        </Link>
      </section>

      <section className="review-metrics-v4">
        <article>
          <span className="review-metric-icon-v4 purple"><Sparkles size={19} /></span>
          <div><strong>{mastered.length}</strong><small>Mục đã học</small></div>
        </article>
        <article>
          <span className="review-metric-icon-v4 rose"><Brain size={19} /></span>
          <div><strong>{weakCount}</strong><small>Điểm yếu</small></div>
        </article>
        <article>
          <span className="review-metric-icon-v4 mint"><ShieldCheck size={19} /></span>
          <div><strong>{strongCount}</strong><small>Đã khá chắc</small></div>
        </article>
      </section>

      <section className="review-list-card review-list-card-v4">
        <div className="section-title-row">
          <div>
            <span className="experience-kicker">
              {queue.length ? "DUE NOW" : "WEAKEST FIRST"}
            </span>
            <h2>
              {queue.length ? "Hàng đợi hôm nay" : "Những điểm nên củng cố"}
            </h2>
          </div>
          <Link href="/practice">
            Practice Hub <ArrowRight size={15} />
          </Link>
        </div>

        {visible.length ? (
          <div className="review-stack-v4">
            {visible.map((item, index) => (
              <Link
                className="review-item-v4"
                href={item.href}
                key={item.id}
              >
                <span className="review-rank-v4">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="review-item-main-v4">
                  <strong className="korean-text">{item.title}</strong>
                  <span>{item.subtitle} · Bài {item.lessonId}</span>
                  <div className="memory-track">
                    <span style={{ width: item.strength + "%" }} />
                  </div>
                </div>
                <div className="review-strength-v4">
                  <strong>{item.strength}%</strong>
                  <span>
                    {item.dueAt <= today ? "Đến hạn" : item.dueAt}
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="review-empty review-empty-v4">
            <CheckCircle2 size={24} />
            <div>
              <strong>Chưa có dữ liệu ôn tập.</strong>
              <p>
                Hoàn thành vài phiên học để Haneul bắt đầu xây lịch ôn cá nhân.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
