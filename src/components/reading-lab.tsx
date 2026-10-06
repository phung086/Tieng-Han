"use client";

import { useState } from "react";
import { ArrowRight, BookOpenText, Check, Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

export function ReadingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const content = lesson?.reading;
  const nextStep = getNextLessonFlowStep(lessonId, "reading");
  const [showTranslation, setShowTranslation] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  if (!lesson || !content) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.reading}
      />
    );
  }

  const reading = content;
  const correct = reading.questions.filter(
    (item, index) => answers[index] === item.answer,
  ).length;

  function submit() {
    setChecked(true);
    reading.questions.forEach((item, index) => {
      recordAnswer("reading", answers[index] === item.answer, item.id);
    });

    if (correct / Math.max(1, reading.questions.length) >= 0.75) {
      completeLessonSkill(lessonId, "reading");
    }
  }

  function reset() {
    setAnswers({});
    setChecked(false);
  }

  return (
    <div className="skill-lab reading-lab">
      <header className="skill-lab-header">
        <span className="eyebrow">
          {messages.skills.reading.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
        </span>
        <h1>{messages.reading.title}</h1>
        <p>{messages.reading.intro}</p>
      </header>

      <section className="reading-workspace">
        <article className="reading-passage">
          <div className="reading-passage-top">
            <div>
              <BookOpenText size={20} />
              <span>{messages.common.lesson} {lessonId} · {reading.title}</span>
            </div>

            <button
              className="text-button"
              onClick={() => setShowTranslation((value) => !value)}
            >
              {showTranslation ? <EyeOff size={16} /> : <Eye size={16} />}
              {showTranslation
                ? messages.reading.hide
                : messages.reading.show}
            </button>
          </div>

          <p className="korean-text">{reading.text}</p>

          {showTranslation ? (
            <div className="translation-box">{reading.translation}</div>
          ) : null}
        </article>

        <article className="reading-questions">
          {reading.questions.map((item, index) => (
            <div className="reading-question" key={item.id}>
              <span>{messages.reading.question} {index + 1}</span>
              <h3 className="korean-text">{item.q}</h3>

              <div className="reading-choice-row">
                {item.choices.map((choice) => {
                  const selected = answers[index] === choice;
                  const state = checked
                    ? choice === item.answer
                      ? " correct"
                      : selected
                        ? " wrong"
                        : ""
                    : selected
                      ? " selected"
                      : "";

                  return (
                    <button
                      className={state}
                      disabled={checked}
                      key={choice}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [index]: choice,
                        }))
                      }
                    >
                      {choice}
                      {checked && choice === item.answer ? (
                        <Check size={15} />
                      ) : null}
                      {checked && selected && choice !== item.answer ? (
                        <X size={15} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {checked ? (
            <div className="reading-result">
              <strong>
                {correct}/{reading.questions.length} {messages.reading.correctSuffix}
              </strong>
              <span>
                {correct === reading.questions.length
                  ? messages.reading.allCorrect
                  : messages.reading.retryNote}
              </span>
            </div>
          ) : null}

          <div className="reading-actions-v4">
            <button
              className="secondary-button"
              disabled={Object.keys(answers).length < reading.questions.length}
              onClick={checked ? reset : submit}
            >
              {checked ? messages.reading.retry : messages.reading.check}
            </button>
            {checked &&
            correct / Math.max(1, reading.questions.length) >= 0.75 ? (
              <Link className="primary-button" href={nextStep.href}>
                Tiếp: {nextStep.label} <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
