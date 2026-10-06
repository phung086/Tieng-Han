"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

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

  function submit() {
    if (!selected || checked) return;
    const correct = selected === item.answer;
    if (correct) setCorrectCount((value) => value + 1);
    setChecked(true);
    recordAnswer("listening", correct, item.id);
  }

  function next() {
    if (index === items.length - 1) {
      completeLessonSkill(lessonId, "listening");
      setFinished(true);
      return;
    }

    setIndex((current) => current + 1);
    setSelected("");
    setChecked(false);
  }

  function restart() {
    setIndex(0);
    setSelected("");
    setChecked(false);
    setCorrectCount(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">{messages.listening.result}</span>
        <h1>{correctCount}/{items.length} {messages.listening.correctSuffix}</h1>
        <p>
          {messages.listening.completionBody} {messages.common.lesson} {lessonId}.
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={16} /> {messages.listening.listenAgain}
          </button>
          <Link className="primary-button" href={nextStep.href}>
            Tiếp: {nextStep.label}
          </Link>
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
                onClick={() => setSelected(choice)}
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
            disabled={!selected}
            onClick={checked ? next : submit}
          >
            {checked
              ? index === items.length - 1
                ? messages.common.finish
                : messages.listening.next
              : messages.listening.check}
          </button>
        </div>
      </section>
    </div>
  );
}
