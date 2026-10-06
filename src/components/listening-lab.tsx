"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

const AUTO_ADVANCE_DELAY_MS = 850;

export function ListeningLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson, course } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const items = lesson?.listening ?? [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  if (!lesson || !items.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.listening}
      />
    );
  }

  const item = items[index];
  const nextStep = getNextLessonFlowStep(lessonId, "listening");

  function play(rate = 0.72) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = rate;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function advance(effectiveCorrectCount = correctCount) {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (index === items.length - 1) {
      if (effectiveCorrectCount / items.length >= 0.75) {
        completeLessonSkill(lessonId, "listening");
      }
      setFinished(true);
      return;
    }

    setIndex((current) => current + 1);
    setSelected("");
    setChecked(false);
  }

  function submit(choiceOverride?: string) {
    const candidate = choiceOverride ?? selected;
    if (!candidate || checked) return;

    const correct = candidate === item.answer;
    const nextCorrectCount = correctCount + (correct ? 1 : 0);

    if (choiceOverride !== undefined) {
      setSelected(choiceOverride);
    }

    setCorrectCount(nextCorrectCount);
    setChecked(true);
    recordAnswer("listening", correct, item.id);

    if (correct) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        advance(nextCorrectCount);
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function restart() {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIndex(0);
    setSelected("");
    setChecked(false);
    setCorrectCount(0);
    setFinished(false);
  }

  if (finished) {
    const score = Math.round(
      (correctCount / Math.max(1, items.length)) * 100,
    );
    const passed = score >= 75;

    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">
          {passed ? messages.listening.result : "CẦN NGHE LẠI THÊM"}
        </span>
        <h1>{correctCount}/{items.length} {messages.listening.correctSuffix}</h1>
        <p>
          {passed
            ? "Bạn đã đạt " + score + "% và đủ điều kiện hoàn thành chặng Nghe."
            : "Bạn đang ở " + score + "%. Nghe lại chậm rồi thử thêm một lượt để đạt tối thiểu 75%."}
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={16} /> {messages.listening.listenAgain}
          </button>
          {passed ? (
            <Link className="primary-button" href={nextStep.href}>
              Tiếp: {nextStep.label}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="skill-lab listening-lab">
      <header className="skill-lab-header">
        <span className="eyebrow">듣기 · {messages.common.lesson.toUpperCase()} {lessonId}</span>
        <h1>{messages.listening.titleCurrent}</h1>
        <p>{messages.listening.introCurrent}</p>
      </header>

      <section className="audio-stage">
        <div className="audio-icon"><Headphones size={33} /></div>
        <div className="sound-wave">
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} style={{ height: 18 + ((i * 13) % 42) + "%" }} />
          ))}
        </div>

        <button className="audio-play" onClick={() => play()}>
          {playing ? <Pause size={22} /> : <Play size={22} />}
          {playing ? messages.listening.playing : messages.listening.listenSentence}
        </button>

        <button className="audio-replay" onClick={() => play(0.56)}>
          <RotateCcw size={15} /> {messages.listening.replaySlow}
        </button>
      </section>

      <section className="listening-question">
        <span>{messages.reading.question} {index + 1}/{items.length}</span>
        <h2>{messages.listening.questionMeaning}</h2>

        <div className="listening-options">
          {item.choices.map((choice) => {
            const state = checked
              ? choice === item.answer
                ? " correct"
                : selected === choice
                  ? " wrong"
                  : ""
              : selected === choice
                ? " selected"
                : "";

            return (
              <button
                className={state}
                disabled={checked}
                key={choice}
                onClick={() => submit(choice)}
              >
                {choice}
              </button>
            );
          })}
        </div>

        <div className="listening-footer">
          {checked ? (
            <p className={selected === item.answer ? "good" : "bad"}>
              {selected === item.answer
                ? messages.listening.correctFeedback
                : messages.listening.answerPrefix + " " + item.answer}
            </p>
          ) : <span />}

          <button
            className="primary-button"
            disabled={!selected || (checked && selected === item.answer)}
            onClick={checked ? () => advance() : () => submit()}
          >
            {checked
              ? selected === item.answer
                ? index === items.length - 1
                  ? "Đúng rồi · đang hoàn tất…"
                  : "Đúng rồi · tự chuyển…"
                : index === items.length - 1
                  ? messages.common.finish
                  : messages.listening.next
              : messages.listening.check}
          </button>
        </div>
      </section>
    </div>
  );
}
