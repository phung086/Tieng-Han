"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

const AUTO_ADVANCE_DELAY_MS = 900;

export function ReadingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const content = lesson?.reading;
  const nextStep = getNextLessonFlowStep(lessonId, "reading");
  const [showTranslation, setShowTranslation] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
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

  if (!lesson || !content || !content.questions.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.reading}
      />
    );
  }

  const reading = content;
  const question = reading.questions[questionIndex];
  const isCorrect = selected === question.answer;
  const progress = Math.round(
    ((questionIndex + (checked ? 1 : 0)) / reading.questions.length) * 100,
  );

  function advance(effectiveCorrectCount = correctCount) {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (questionIndex === reading.questions.length - 1) {
      const passed =
        effectiveCorrectCount / Math.max(1, reading.questions.length) >= 0.75;

      if (passed) {
        completeLessonSkill(lessonId, "reading");
      }

      setFinished(true);
      return;
    }

    setQuestionIndex((value) => value + 1);
    setSelected("");
    setChecked(false);
  }

  function choose(choice: string) {
    if (checked) return;

    const correct = choice === question.answer;
    const nextCorrectCount = correctCount + (correct ? 1 : 0);

    setSelected(choice);
    setChecked(true);
    setCorrectCount(nextCorrectCount);
    recordAnswer("reading", correct, question.id);

    if (correct) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        advance(nextCorrectCount);
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function reset() {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    setQuestionIndex(0);
    setSelected("");
    setChecked(false);
    setCorrectCount(0);
    setFinished(false);
  }

  const finalScore = Math.round(
    (correctCount / Math.max(1, reading.questions.length)) * 100,
  );
  const passed = finalScore >= 75;

  return (
    <div className="skill-lab reading-lab reading-lab-v5">
      <header className="skill-lab-header reading-head-v5">
        <div>
          <span className="eyebrow">
            {messages.skills.reading.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
          </span>
          <h1>{messages.reading.title}</h1>
          <p>{messages.reading.intro}</p>
        </div>
        <span className="reading-progress-pill-v5">
          {finished ? (
            "Hoàn tất"
          ) : (
            <>
              {questionIndex + 1}/{reading.questions.length} câu
            </>
          )}
        </span>
      </header>

      <div className="reading-progress-track-v5" aria-label="Tiến độ đọc hiểu">
        <span style={{ width: (finished ? 100 : progress) + "%" }} />
      </div>

      <section className="reading-workspace reading-workspace-v5">
        <article className="reading-passage reading-passage-v5">
          <div className="reading-passage-top">
            <div>
              <BookOpenText size={20} />
              <span>{messages.common.lesson} {lessonId} · {reading.title}</span>
            </div>

            <button
              className="text-button"
              onClick={() => setShowTranslation((value) => !value)}
              type="button"
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

        <article className="reading-questions reading-question-stage-v5">
          {finished ? (
            <div className="reading-complete-v5">
              <div className={passed ? "reading-complete-icon-v5 passed" : "reading-complete-icon-v5"}>
                <CheckCircle2 size={28} />
              </div>
              <span className="experience-kicker">READING RESULT</span>
              <h2>{correctCount}/{reading.questions.length} câu đúng</h2>
              <strong>{finalScore}%</strong>
              <p>
                {passed
                  ? "Bạn đã đủ chắc để chuyển sang kỹ năng tiếp theo."
                  : "Bạn chưa đạt 75%. Hãy xem lại đoạn đọc và thử thêm một lượt."}
              </p>
              <div className="reading-actions-v4">
                <button className="secondary-button" onClick={reset} type="button">
                  <RotateCcw size={16} /> {messages.reading.retry}
                </button>
                {passed ? (
                  <Link className="primary-button" href={nextStep.href}>
                    Tiếp: {nextStep.label} <ArrowRight size={16} />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="reading-question-top-v5">
                <span>
                  {messages.reading.question} {questionIndex + 1}
                </span>
                <small>
                  {checked
                    ? isCorrect
                      ? "Đúng · đang chuyển câu tiếp"
                      : "Xem lại đáp án rồi tiếp tục"
                    : "Chọn một đáp án"}
                </small>
              </div>

              <div className="reading-question current" key={question.id}>
                <h3 className="korean-text">{question.q}</h3>

                <div className="reading-choice-row">
                  {question.choices.map((choice) => {
                    const choiceSelected = selected === choice;
                    const state = checked
                      ? choice === question.answer
                        ? " correct"
                        : choiceSelected
                          ? " wrong"
                          : ""
                      : choiceSelected
                        ? " selected"
                        : "";

                    return (
                      <button
                        className={state}
                        disabled={checked}
                        key={choice}
                        onClick={() => choose(choice)}
                        type="button"
                      >
                        <span>{choice}</span>
                        {checked && choice === question.answer ? (
                          <Check size={15} />
                        ) : null}
                        {checked &&
                        choiceSelected &&
                        choice !== question.answer ? (
                          <X size={15} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {checked ? (
                <div className={isCorrect ? "reading-feedback-v5 good" : "reading-feedback-v5 bad"}>
                  <strong>
                    {isCorrect ? "Chính xác!" : "Chưa đúng."}
                  </strong>
                  <span>
                    {isCorrect
                      ? "Haneul sẽ tự chuyển sau một nhịp ngắn."
                      : "Đáp án đúng: " + question.answer}
                  </span>
                </div>
              ) : null}

              <div className="reading-actions-v4">
                {checked && !isCorrect ? (
                  <button
                    className="primary-button"
                    onClick={() => advance()}
                    type="button"
                  >
                    {questionIndex === reading.questions.length - 1
                      ? messages.common.finish
                      : messages.listening.next}
                    <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
