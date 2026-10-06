"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flame,
  Heart,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import { useLearning, type SkillKey } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import {
  masteryPassed,
  pickBalancedQuestions,
} from "@/lib/study-session-plan";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

export type StudySessionMode = "guided" | "quick" | "mastery";

const AUTO_ADVANCE_DELAY_MS = 850;

const normalize = (value: string) =>
  value
    .trim()
    .replace(/[.!?。！？]/g, "")
    .replace(/\s+/g, " ");

export function StudySession({
  lessonId,
  mode = "guided",
  skill,
}: {
  lessonId?: number;
  mode?: StudySessionMode;
  skill?: SkillKey;
}) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { course } = useContent();
  const messages = useMessages();

  const activeLessonId = lessonId ?? course.lessons[0]?.id ?? 1;

  const baseQuestions = useMemo(() => {
    const all = course.questions.filter(
      (item) =>
        item.lessonId === activeLessonId &&
        (!skill || item.skill === skill),
    );

    if (mode === "quick") return all.slice(0, 5);
    if (mode === "mastery") return all;
    return pickBalancedQuestions(all, 8);
  }, [course.questions, activeLessonId, mode, skill]);

  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const questions = retryIds
    ? baseQuestions.filter((item) => retryIds.includes(item.id))
    : baseQuestions;

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [mistakeIds, setMistakeIds] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [focus, setFocus] = useState(3);
  const [showHint, setShowHint] = useState(false);
  const [skillStats, setSkillStats] = useState<
    Partial<Record<SkillKey, { correct: number; total: number }>>
  >({});
  const autoAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  if (!questions.length) {
    return (
      <EmptySkillState
        lessonId={activeLessonId}
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

  const modeCopy = {
    guided: {
      label: "Bài học nhanh",
      title: "Học theo nhịp",
      note: "Một phiên ngắn, trộn đều các kỹ năng.",
    },
    quick: {
      label: "Quick 5",
      title: "5 câu khởi động",
      note: "Phiên siêu ngắn để giữ nhịp học.",
    },
    mastery: {
      label: "Mastery",
      title: "Chinh phục bài",
      note: "Làm toàn bộ câu hỏi của bài để kiểm tra độ chắc.",
    },
  }[mode];

  function advance(
    effectiveCorrectCount = correctCount,
    effectiveSkillStats = skillStats,
  ) {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (index === questions.length - 1) {
      if (
        skill &&
        masteryPassed(effectiveCorrectCount, questions.length)
      ) {
        completeLessonSkill(activeLessonId, skill);
      } else if (mode === "mastery" && !retryIds) {
        for (const [skillKey, stat] of Object.entries(
          effectiveSkillStats,
        )) {
          if (stat && masteryPassed(stat.correct, stat.total)) {
            completeLessonSkill(activeLessonId, skillKey as SkillKey);
          }
        }
      }
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setAnswer("");
    setTokens([]);
    setChecked(false);
    setShowHint(false);
  }

  function submit(answerOverride?: string) {
    const candidate = answerOverride ?? submittedAnswer;
    if (!candidate || checked) return;

    const correct =
      normalize(candidate) === normalize(question.answer);
    const nextCorrectCount = correctCount + (correct ? 1 : 0);
    const previousSkill = skillStats[question.skill] ?? {
      correct: 0,
      total: 0,
    };
    const nextSkillStats = {
      ...skillStats,
      [question.skill]: {
        correct: previousSkill.correct + (correct ? 1 : 0),
        total: previousSkill.total + 1,
      },
    };

    if (answerOverride !== undefined) {
      setAnswer(answerOverride);
    }

    setChecked(true);
    setCorrectCount(nextCorrectCount);
    setSkillStats(nextSkillStats);

    if (correct) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
    } else {
      setCombo(0);
      setFocus((value) => Math.max(0, value - 1));
      setMistakeIds((current) =>
        current.includes(question.id)
          ? current
          : [...current, question.id],
      );
    }

    recordAnswer(question.skill, correct, question.id);

    if (correct) {
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        advance(nextCorrectCount, nextSkillStats);
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function resetSession(nextRetryIds: string[] | null) {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setRetryIds(nextRetryIds);
    setIndex(0);
    setAnswer("");
    setTokens([]);
    setChecked(false);
    setCorrectCount(0);
    setFinished(false);
    setMistakeIds([]);
    setCombo(0);
    setBestCombo(0);
    setFocus(3);
    setShowHint(false);
    setSkillStats({});
  }

  if (finished) {
    const score = Math.round(
      (correctCount / Math.max(1, questions.length)) * 100,
    );
    const estimatedXp =
      correctCount * 10 + (questions.length - correctCount) * 2;
    const nextSkillStep = skill
      ? getNextLessonFlowStep(activeLessonId, skill)
      : null;

    return (
      <div className="session-complete session-complete-v3">
        <div className="complete-orb"><Trophy size={34} /></div>
        <span className="eyebrow">{modeCopy.label} hoàn tất</span>
        <h1>
          {score >= 90
            ? "Quá chắc tay!"
            : score >= 75
              ? "Tiến bộ rất ổn."
              : "Ôn lại vài điểm rồi thử tiếp nhé."}
        </h1>
        <p>
          Bạn trả lời đúng {correctCount}/{questions.length} câu trong phiên này.
        </p>

        <div className="session-result-grid-v3">
          <article>
            <strong>{score}%</strong>
            <span>Độ chính xác</span>
          </article>
          <article>
            <strong>+{estimatedXp}</strong>
            <span>XP phiên học</span>
          </article>
          <article>
            <strong>{bestCombo}</strong>
            <span>Combo tốt nhất</span>
          </article>
          <article>
            <strong>{mistakeIds.length}</strong>
            <span>Điểm cần ôn</span>
          </article>
        </div>

        <div className="complete-actions">
          {mistakeIds.length ? (
            <button
              className="secondary-button"
              onClick={() => resetSession([...mistakeIds])}
            >
              <RotateCcw size={17} /> Luyện lại câu sai
            </button>
          ) : (
            <button
              className="secondary-button"
              onClick={() => resetSession(null)}
            >
              <RotateCcw size={17} /> Làm lại phiên
            </button>
          )}
          <Link
            className="primary-button"
            href={nextSkillStep?.href ?? ("/learn/" + activeLessonId)}
          >
            {nextSkillStep
              ? "Tiếp: " + nextSkillStep.label
              : mode === "mastery"
                ? "Hoàn tất bài học"
                : "Quay lại bài học"}
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="study-session study-session-v3">
      <header className="session-header session-header-v3">
        <Link
          className="icon-button"
          href={"/learn/" + activeLessonId}
          aria-label={messages.quiz.exit}
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="session-progress-wrap-v3">
          <div className="session-progress">
            <span style={{ width: progress + "%" }} />
          </div>
          <small>{modeCopy.label} · {progress}%</small>
        </div>

        <div className="session-hud-v3">
          <span title="Focus">
            <Heart size={16} fill="currentColor" />
            {focus}
          </span>
          <span title="Combo">
            <Flame size={16} />
            {combo}
          </span>
          <strong>{index + 1}/{questions.length}</strong>
        </div>
      </header>

      <main className="session-body session-body-v3">
        <div className="session-mode-copy-v3">
          <span className="pill pill-soft">
            {skillLabel} · {messages.common.lesson} {activeLessonId}
          </span>
          <small>{modeCopy.note}</small>
        </div>

        <h1>{question.title}</h1>
        <div className="question-prompt korean-text">
          {question.prompt}
        </div>

        {question.translation ? (
          <p className="question-translation">
            {question.translation}
          </p>
        ) : null}

        {!checked ? (
          <button
            className="session-hint-button-v3"
            type="button"
            onClick={() => setShowHint((value) => !value)}
          >
            <Lightbulb size={16} />
            {showHint ? "Ẩn gợi ý" : "Cần một gợi ý?"}
          </button>
        ) : null}

        {showHint && !checked ? (
          <div className="session-hint-v3">
            <Sparkles size={17} />
            <span>
              {question.translation
                ? "Hãy dựa vào nghĩa câu và cấu trúc đã học trong bài."
                : "Thử loại các đáp án không khớp với từ vựng hoặc mẫu ngữ pháp của bài."}
            </span>
          </div>
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
                  onClick={() => submit(choice)}
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

        {checked ? (
          <div
            className={
              "answer-coach-v3 " + (isCorrect ? "success" : "error")
            }
          >
            <div className="answer-coach-icon-v3">
              {isCorrect ? <Check size={21} /> : <X size={21} />}
            </div>
            <div>
              <strong>
                {isCorrect ? "Chính xác!" : "Chưa đúng, nhưng đây là điểm cần nhớ."}
              </strong>
              <p>{question.explanation}</p>
              {!isCorrect ? (
                <small>
                  Đáp án đúng: <b>{question.answer}</b>
                </small>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      <footer
        className={
          "session-footer session-footer-v3" +
          (checked
            ? isCorrect
              ? " success"
              : " error"
            : "")
        }
      >
        <div className="session-footer-copy-v3">
          {checked ? (
            <>
              <Target size={17} />
              <span>
                {isCorrect
                  ? combo >= 2
                    ? "Combo " + combo + " · giữ nhịp nhé!"
                    : "Tốt lắm, tiếp tục thôi."
                  : "Sai một câu không sao — hệ thống sẽ đưa điểm này vào ôn tập."}
              </span>
            </>
          ) : (
            <span>{messages.quiz.xpHint}</span>
          )}
        </div>

        <button
          className="primary-button"
          disabled={!submittedAnswer || (checked && isCorrect)}
          onClick={checked ? () => advance() : () => submit()}
        >
          {checked
            ? isCorrect
              ? index === questions.length - 1
                ? "Đúng rồi · đang hoàn tất…"
                : "Đúng rồi · tự chuyển…"
              : index === questions.length - 1
                ? messages.quiz.result
                : messages.quiz.continue
            : messages.quiz.check}
          <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  );
}
