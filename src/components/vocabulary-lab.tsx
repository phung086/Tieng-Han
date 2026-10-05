"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, RotateCcw, Shuffle, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";

export function VocabularyLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson, course } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const deck = lesson?.vocabulary ?? [];
  const [order, setOrder] = useState(deck.map((_, index) => index));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!lesson || !deck.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.vocabulary}
      />
    );
  }

  const card = deck[order[position]];
  const progress = Math.round(((position + 1) / order.length) * 100);

  function speak() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.ko);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function rate(correct: boolean) {
    recordAnswer("vocabulary", correct, card.id);
    if (correct) setKnown((value) => value + 1);

    if (position === order.length - 1) {
      completeLessonSkill(lessonId, "vocabulary");
      setFinished(true);
      return;
    }

    setPosition((value) => value + 1);
    setRevealed(false);
  }

  function restart() {
    setPosition(0);
    setRevealed(false);
    setKnown(0);
    setFinished(false);
  }

  function shuffle() {
    setOrder((current) => [...current].sort(() => Math.random() - 0.5));
    restart();
  }

  if (finished) {
    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">{messages.vocabulary.complete}</span>
        <h1>{known}/{deck.length} {messages.vocabulary.rememberedSuffix}</h1>
        <p>
          {messages.vocabulary.completionBody} {messages.common.lesson} {lessonId}.
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={16} /> {messages.vocabulary.reviewAgain}
          </button>
          <Link className="primary-button" href={"/learn/" + lessonId}>
            {messages.common.backToLesson}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lab-page">
      <header className="lab-header">
        <div>
          <span className="eyebrow">FLASHCARD · {messages.common.lesson.toUpperCase()} {lessonId}</span>
          <h1>{messages.vocabulary.titleShort}</h1>
          <p>
            {revealed
              ? messages.vocabulary.rememberPrompt
              : messages.vocabulary.recallPrompt}
          </p>
        </div>

        <div className="lab-actions">
          <button className="secondary-button" onClick={shuffle}>
            <Shuffle size={16} /> {messages.vocabulary.shuffle}
          </button>
          <button className="icon-button" onClick={restart} aria-label={messages.common.restart}>
            <RotateCcw size={17} />
          </button>
        </div>
      </header>

      <div className="lab-progress"><span style={{ width: progress + "%" }} /></div>

      <div
        className={"flashcard" + (revealed ? " revealed" : "")}
        onClick={() => setRevealed((value) => !value)}
        role="button"
        tabIndex={0}
      >
        <span className="flash-index">{position + 1} / {order.length}</span>
        <button
          className="sound-button"
          onClick={(event) => {
            event.stopPropagation();
            speak();
          }}
          type="button"
          aria-label={messages.vocabulary.hearPronunciation}
        >
          <Volume2 size={20} />
        </button>

        <div className="flash-front">
          <strong>{card.ko}</strong>
          <span>{messages.vocabulary.tapMeaning}</span>
        </div>

        <div className="flash-back">
          <strong>{card.vi}</strong>
          <p className="korean-text">{card.example}</p>
          <span>{messages.vocabulary.tapBack}</span>
        </div>
      </div>

      <div className="memory-actions">
        <button
          disabled={!revealed}
          className="memory-button learning"
          onClick={() => rate(false)}
        >
          <span>↻</span>
          <strong>{messages.vocabulary.forgot}</strong>
          <small>{messages.vocabulary.forgotNote}</small>
        </button>

        <button
          disabled={!revealed}
          className="memory-button known"
          onClick={() => rate(true)}
        >
          <span>✓</span>
          <strong>{messages.vocabulary.remembered}</strong>
          <small>{messages.vocabulary.rememberedNote}</small>
        </button>
      </div>

      <div className="lab-meta">
        <span>{known} {messages.vocabulary.rememberedSession}</span>
        <span>{order.length - position} {messages.vocabulary.remaining}</span>
      </div>
    </div>
  );
}
