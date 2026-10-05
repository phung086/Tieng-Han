"use client";

import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";

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
      subtitle: messages.review.labels.speaking + " · " + messages.review.labels.shadowing,
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
      ? [{
          id: "writing-" + lesson.id,
          title: lesson.writing.prompt,
          subtitle: messages.review.labels.writing,
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
          <span className="kicker">{messages.review.kicker}</span>
          <h1>{messages.review.title}</h1>
          <p>{messages.review.intro}</p>
        </div>
      </header>

      <section className="review-summary">
        <div className="review-hero-icon">
          {queue.length ? <Brain size={28} /> : <CheckCircle2 size={28} />}
        </div>
        <div>
          <span className="eyebrow">
            {queue.length ? messages.review.dueToday : messages.review.queueClean}
          </span>
          <h2>
            {queue.length
              ? queue.length + " " + messages.review.dueSuffix
              : messages.review.noOverdue}
          </h2>
          <p>
            {queue.length
              ? messages.review.weakFirst
              : mastered.length
                ? messages.review.waiting
                : messages.review.firstSession}
          </p>
        </div>
        <Link
          className="primary-button"
          href={queue[0]?.href ?? weak[0]?.href ?? "/practice"}
        >
          {queue.length ? messages.review.start : messages.review.freePractice} <ArrowRight size={18} />
        </Link>
      </section>

      <section className="review-list-card">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">
              {queue.length ? messages.review.due : messages.review.recentWeak}
            </span>
            <h2>
              {queue.length ? messages.review.priority : messages.review.watch}
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
                  <span>{item.strength}% {messages.review.memory}</span>
                </div>
                <div className="due-cell">
                  <Clock3 size={15} />
                  {item.dueAt <= today ? messages.review.due : item.dueAt}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="review-empty">
            <CheckCircle2 size={24} />
            <div>
              <strong>{messages.review.emptyTitle}</strong>
              <p>{messages.review.emptyBody}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
