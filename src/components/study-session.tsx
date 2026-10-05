"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";

const normalize = (value: string) =>
  value
    .trim()
    .replace(/[.!?。！？]/g, "")
    .replace(/\s+/g, " ");

export function StudySession({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { course } = useContent();
  const messages = useMessages();

  const questions = useMemo(
    () =>
      course.questions.filter((item) => item.lessonId === lessonId),
    [course.questions, lessonId],
  );

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!questions.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.practice.modes.mixed.title}
      />
    );
  }

  const question = questions[index];
  const submittedAnswer =
    question.type === "reorder" ? tokens.join(" ") : answer;
  const isCorrect =
    normalize(submittedAnswer) === normalize(question.answer);

  const progress = Math.round(
    ((index + (checked ? 1 : 0)) / questions.length) * 100,
  );

  const skillLabel = {
    vocabulary: messages.skills.vocabulary.vi,
    grammar: messages.skills.grammar.vi,
    listening: messages.skills.listening.vi,
    speaking: messages.skills.speaking.vi,
    reading: messages.skills.reading.vi,
    writing: messages.skills.writing.vi,
  }[question.skill];

  function submit() {
    if (!submittedAnswer || checked) return;

    setChecked(true);

    if (isCorrect) {
      setCorrectCount((value) => value + 1);
    }

    recordAnswer(question.skill, isCorrect, question.id);
  }

  function next() {
    if (index === questions.length - 1) {
      completeLessonSkill(lessonId, "grammar");
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setAnswer("");
    setTokens([]);
    setChecked(false);
  }

  function restart() {
    setIndex(0);
    setAnswer("");
    setTokens([]);
    setChecked(false);
    setCorrectCount(0);
    setFinished(false);
  }

  if (finished) {
    const score = Math.round(
      (correctCount / questions.length) * 100,
    );

    return (
      <div className="session-complete">
        <div className="complete-orb"><Trophy size={34} /></div>
        <span className="eyebrow">{messages.quiz.complete}</span>
        <h1>
          {score >= 80
            ? messages.quiz.great
            : messages.quiz.retryTitle}
        </h1>
        <p>
          {messages.quiz.answerSummaryPrefix} {correctCount}/{questions.length}{" "}
          {messages.quiz.answerSummarySuffix}
        </p>
        <div className="score-ring-big">
          <strong>{score}%</strong>
          <span>{messages.quiz.accuracy}</span>
        </div>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={17} /> {messages.common.restart}
          </button>
          <Link className="primary-button" href={"/learn/" + lessonId}>
            {messages.common.backToLesson} <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="study-session">
      <header className="session-header">
        <Link
          className="icon-button"
          href={"/learn/" + lessonId}
          aria-label={messages.quiz.exit}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="session-progress">
          <span style={{ width: progress + "%" }} />
        </div>
        <strong>{index + 1}/{questions.length}</strong>
      </header>

      <main className="session-body">
        <span className="pill pill-soft">
          {skillLabel} · {messages.common.lesson} {lessonId}
        </span>
        <h1>{question.title}</h1>
        <div className="question-prompt korean-text">
          {question.prompt}
        </div>

        {question.translation ? (
          <p className="question-translation">
            {question.translation}
          </p>
        ) : null}

        {question.type === "choice" ? (
          <div className="session-options">
            {question.choices?.map((choice, choiceIndex) => {
              const selected = answer === choice;
              const state = checked
                ? choice === question.answer
                  ? " correct"
                  : selected
                    ? " wrong"
                    : ""
                : selected
                  ? " selected"
                  : "";

              return (
                <button
                  className={"session-option" + state}
                  disabled={checked}
                  key={choice}
                  onClick={() => setAnswer(choice)}
                  type="button"
                >
                  <span>
                    {String.fromCharCode(65 + choiceIndex)}
                  </span>
                  <strong
                    className={
                      /[가-힣]/.test(choice) ? "korean-text" : ""
                    }
                  >
                    {choice}
                  </strong>
                  {checked && choice === question.answer ? (
                    <Check size={19} />
                  ) : null}
                  {checked &&
                  selected &&
                  choice !== question.answer ? (
                    <X size={19} />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.type === "input" ? (
          <div className="input-answer-wrap">
            <input
              autoComplete="off"
              autoFocus
              className={
                "text-answer" +
                (checked
                  ? isCorrect
                    ? " correct"
                    : " wrong"
                  : "")
              }
              disabled={checked}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && submit()
              }
              placeholder={messages.quiz.inputPlaceholder}
              value={answer}
            />
            <span>{messages.quiz.enterHint}</span>
          </div>
        ) : null}

        {question.type === "reorder" ? (
          <div className="reorder-area">
            <div className="built-sentence">
              {tokens.length ? (
                tokens.map((token, tokenIndex) => (
                  <button
                    key={token + "-" + tokenIndex}
                    onClick={() =>
                      setTokens((current) =>
                        current.filter(
                          (_, itemIndex) =>
                            itemIndex !== tokenIndex,
                        ),
                      )
                    }
                  >
                    {token}
                  </button>
                ))
              ) : (
                <span>{messages.quiz.reorderHint}</span>
              )}
            </div>

            <div className="token-bank">
              {question.tokens
                ?.filter((token) => !tokens.includes(token))
                .map((token) => (
                  <button
                    disabled={checked}
                    key={token}
                    onClick={() =>
                      setTokens((current) => [
                        ...current,
                        token,
                      ])
                    }
                  >
                    {token}
                  </button>
                ))}
            </div>
          </div>
        ) : null}
      </main>

      <footer
        className={
          "session-footer" +
          (checked
            ? isCorrect
              ? " success"
              : " error"
            : "")
        }
      >
        {checked ? (
          <div className="session-feedback">
            <div className="feedback-icon">
              {isCorrect ? <Check size={20} /> : <X size={20} />}
            </div>
            <div>
              <strong>
                {isCorrect
                  ? messages.quiz.correct
                  : messages.quiz.wrong}
              </strong>
              <p>{question.explanation}</p>
            </div>
          </div>
        ) : (
          <span className="footer-hint">
            {messages.quiz.xpHint}
          </span>
        )}

        <button
          className="primary-button"
          disabled={!submittedAnswer}
          onClick={checked ? next : submit}
        >
          {checked
            ? index === questions.length - 1
              ? messages.quiz.result
              : messages.quiz.continue
            : messages.quiz.check}
          <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  );
}
