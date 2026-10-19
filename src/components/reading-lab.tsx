"use client";

import { useRef, useState } from "react";
import { useAutoAdvance } from "@/lib/use-auto-advance";
import { SessionFlowControl } from "@/components/session-flow-control";
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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const submissionLock = useRef(false);
  const transitionLock = useRef<number | null>(null);
  const flow = useAutoAdvance(questionIndex, checked && !finished && answers[questionIndex] === content?.questions[questionIndex]?.answer, next);

  if (!lesson || !content || !content.questions.length) {
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

  function submit(response = answers[questionIndex]) {
    if (checked || submissionLock.current || !response) return;
    submissionLock.current = true;
    setAnswers(current => ({ ...current, [questionIndex]: response }));
    setChecked(true);
    const item = reading.questions[questionIndex];
    recordAnswer("reading", response === item.answer, item.id);
  }

  function next() {
    if (!checked || transitionLock.current === questionIndex) return;
    transitionLock.current = questionIndex;
    if (questionIndex === reading.questions.length - 1) {
      if (correct / reading.questions.length >= 0.75) completeLessonSkill(lessonId, "reading");
      setFinished(true);
    } else {
      setQuestionIndex(index => index + 1);
      setChecked(false);
      submissionLock.current = false;
    }
  }

  function reset() {
    setAnswers({});
    setChecked(false);
    setQuestionIndex(0);
    setFinished(false);
    submissionLock.current = false;
    transitionLock.current = null;
    flow.reset();
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
          {!finished && <SessionFlowControl flow={flow} stepKey={questionIndex} />}
          {reading.questions.map((item, index) => finished || index === questionIndex ? (
            <div className="reading-question question-scene" key={item.id}>
              <span>{messages.reading.question} {index + 1}/{reading.questions.length}</span>
              <h3 className="korean-text">{item.q}</h3>

              <div className="reading-choice-row">
                {item.choices.map((choice) => {
                  const selected = answers[index] === choice;
                  const state = checked || finished
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
                      disabled={checked || finished}
                      key={choice}
                      onClick={() => submit(choice)}
                    >
                      {choice}
                      {(checked || finished) && choice === item.answer ? (
                        <Check size={15} />
                      ) : null}
                      {(checked || finished) && selected && choice !== item.answer ? (
                        <X size={15} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null)}

          {finished ? (
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
              disabled={!checked && !finished}
              onClick={finished ? reset : next}
            >
              {finished ? messages.reading.retry : questionIndex === reading.questions.length - 1 ? "Xem kết quả" : "Câu tiếp theo"}
            </button>
            {finished &&
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
