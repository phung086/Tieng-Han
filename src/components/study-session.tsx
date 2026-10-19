"use client";

import { useMemo, useRef, useState } from "react";
import { useAutoAdvance } from "@/lib/use-auto-advance";
import { SessionFlowControl } from "@/components/session-flow-control";
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
import { LearningLoading } from "@/components/learning-loading";
import { answersMatch, availableTokenIndexes } from "@/lib/answer-check";
import { formatReviewDate, selectReviewQuestions, skillNames, type ReviewItem } from "@/lib/review-plan";
import { lessonSkillCount, localDateKey } from "@/lib/learning-model";
import { LessonCoach } from "@/components/lesson-coach";

export type StudySessionMode = "guided" | "quick" | "mastery" | "review";

type SessionProps = { lessonId?: number; mode?: StudySessionMode; skill?: SkillKey; reviewItemId?: string };

export function StudySession(props: SessionProps) {
  const { course, hydrated: contentHydrated } = useContent();
  const { state, hydrated } = useLearning();
  if (!contentHydrated || (course.lessons.length > 0 && !hydrated)) return <LearningLoading />;
  const lessonId = props.lessonId ?? course.lessons.find(lesson => (state.lessonProgress[lesson.id] ?? 0) < 100)?.id ?? course.lessons[0]?.id;
  return <StudySessionRunner key={[course.id, lessonId, props.mode, props.skill, props.reviewItemId].join(":")} {...props} lessonId={lessonId} />;
}

function StudySessionRunner({
  lessonId,
  mode = "guided",
  skill,
  reviewItemId,
}: SessionProps) {
  const { state, recordAnswer, completeLessonSkill, completeLessonMastery } = useLearning();
  const { course } = useContent();
  const messages = useMessages();

  const activeLessonId = lessonId ?? course.lessons[0]?.id ?? 1;
  const [reviewQuestions] = useState(() => selectReviewQuestions(course, state, localDateKey(), reviewItemId));

  const baseQuestions = useMemo<ReviewItem[]>(() => {
    if (mode === "review") return reviewQuestions;
    const all = course.questions.filter(
      (item) =>
        item.lessonId === activeLessonId &&
        (!skill || item.skill === skill),
    );

    if (skill) return all;
    if (mode === "quick") return pickBalancedQuestions(all, 5);
    if (mode === "mastery") return all;
    return pickBalancedQuestions(all, 8);
  }, [course.questions, activeLessonId, mode, skill, reviewQuestions]);

  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const questions = retryIds
    ? baseQuestions.filter((item) => retryIds.includes(item.id))
    : baseQuestions;

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tokens, setTokens] = useState<number[]>([]);
  const [rating, setRating] = useState<boolean | null>(null);
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
  const submissionLock = useRef(false);
  const transitionLock = useRef<string | null>(null);
  const candidate = questions[index];
  const flow = useAutoAdvance(index, checked && !finished && Boolean(candidate) && (candidate?.reviewKind ? rating === true : answersMatch(candidate?.type === "reorder" ? tokens.map(token => candidate.tokens?.[token]).join(" ") : answer, candidate?.answer ?? "")), next);

  if (!questions.length) {
    if (mode === "review") return <div className="skill-complete-card">
      <Check size={32} /><h1>Đã xong hàng đợi ôn tập.</h1>
      <p>Phiên ôn chỉ chứa những mục đã học và đến hạn trong giáo trình đang chọn.</p>
      <Link className="primary-button" href="/review">Xem lịch ôn tiếp theo <ArrowRight size={17} /></Link>
    </div>;
    return (
      <EmptySkillState
        lessonId={activeLessonId}
        skill={messages.practice.modes.mixed.title}
      />
    );
  }

  const question = questions[index];
  const submittedAnswer =
    question.type === "reorder" ? tokens.map(index => question.tokens?.[index]).join(" ") : answer;
  const isCorrect =
    question.reviewKind ? rating === true : answersMatch(submittedAnswer, question.answer);
  const canSubmit = question.type === "reorder" ? tokens.length === question.tokens?.length : Boolean(submittedAnswer.trim());

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
    review: { label: "Ôn đến hạn", title: "Củng cố điều đã học", note: "Tối đa 10 mục mỗi phiên, ưu tiên mục quá hạn. Không mở bài mới." },
  }[mode];

  function submit(selfRating?: boolean, response?: string) {
    if (submissionLock.current || checked || (selfRating === undefined && !response && !canSubmit)) return;
    submissionLock.current = true;
    const answerCorrect = selfRating ?? answersMatch(response ?? submittedAnswer, question.answer);
    if (selfRating !== undefined) setRating(selfRating);

    setChecked(true);

    if (answerCorrect) {
      setCorrectCount((value) => value + 1);
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

    setSkillStats((current) => {
      const previous = current[question.skill] ?? { correct: 0, total: 0 };
      return {
        ...current,
        [question.skill]: {
          correct: previous.correct + (answerCorrect ? 1 : 0),
          total: previous.total + 1,
        },
      };
    });

    recordAnswer(question.skill, answerCorrect, question.id);
  }

  function next() {
    if (!checked || transitionLock.current === question.id) return;
    transitionLock.current = question.id;
    if (index === questions.length - 1) {
      if (mode !== "review" && !retryIds && skill && masteryPassed(correctCount, questions.length)) {
        completeLessonSkill(activeLessonId, skill);
      } else if (mode === "mastery" && !retryIds && masteryPassed(correctCount, questions.length)) {
        completeLessonMastery(activeLessonId);
      }
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setAnswer("");
    setTokens([]);
    setChecked(false);
    setShowHint(false);
    setRating(null);
    submissionLock.current = false;
  }

  function resetSession(nextRetryIds: string[] | null) {
    submissionLock.current = false;
    transitionLock.current = null;
    flow.reset();
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
    setRating(null);
  }

  if (finished) {
    const score = Math.round(
      (correctCount / Math.max(1, questions.length)) * 100,
    );
    const estimatedXp =
      correctCount * 10 + (questions.length - correctCount) * 2;
    const passed = masteryPassed(correctCount, questions.length);
    const nextSkillStep = skill && passed && !retryIds
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
        {mode === "mastery" && (!passed || retryIds || lessonSkillCount(state, activeLessonId) < 6) ? <p className="session-note">
          {retryIds ? "Luyện lại câu sai giúp củng cố. Hãy làm lại bài kiểm tra đầy đủ để ghi nhận kết quả." : !passed ? "Chưa đạt ngưỡng 75%. Bài học chưa được đánh dấu hoàn thành." : "Đã đạt bài kiểm tra. Hãy hoàn thành đủ 6 chặng kỹ năng để kết thúc bài học."}
        </p> : null}
        {mode === "review" ? <p className="session-note">Lịch ôn đã cập nhật cho đúng từng mục. Tự đánh giá không thay thế chấm phát âm hoặc bài viết.</p> : null}

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
          <div className="session-skill-results">{Object.entries(skillStats).map(([key, stat]) => stat ? <span key={key}>{skillNames[key as SkillKey]}: {stat.correct}/{stat.total}</span> : null)}</div>
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
            href={mode === "review" ? "/review" : nextSkillStep?.href ?? ("/learn/" + activeLessonId)}
          >
            {mode === "review" ? "Xem lịch ôn" : nextSkillStep
              ? "Tiếp: " + nextSkillStep.label
              : mode === "mastery"
                ? "Xem kết quả bài học"
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
          href={mode === "review" ? "/review" : "/learn/" + activeLessonId}
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

      <SessionFlowControl flow={flow} stepKey={index} />
      <main key={question.id} className="session-body session-body-v3 question-scene">
        <div className="session-mode-copy-v3">
          <span className="pill pill-soft">
            {skillLabel} · {messages.common.lesson} {question.lessonId}
          </span>
          <small>{modeCopy.note}</small>
        </div>

        <h1>{question.title}</h1>
        {question.context ? <p className="session-source-context korean-text">{question.context}</p> : null}
        <div className="question-prompt korean-text">
          {question.prompt}
        </div>
        {question.audioText ? <button className="secondary-button" type="button" onClick={() => {
          if (!("speechSynthesis" in window)) return;
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(question.audioText!);
          utterance.lang = course.language?.locale ?? "ko-KR"; utterance.rate = 0.75;
          window.speechSynthesis.speak(utterance);
        }}>Nghe giọng đọc tổng hợp</button> : null}
        {question.reviewKind ? <div className="recall-card">
          <p>{question.reviewKind === "speaking" ? "Đọc to câu phía trên, rồi tự đánh giá mức độ nhớ." : question.reviewKind === "writing" ? "Thử viết theo yêu cầu trước khi xem gợi ý." : "Nhớ lại nghĩa tiếng Việt trước khi mở đáp án."}</p>
          {showHint || checked ? <div className="recall-answer"><strong>{question.answer}</strong><p>{question.explanation}</p></div> : null}
        </div> : null}

        {question.translation ? (
          <p className="question-translation">
            {question.translation}
          </p>
        ) : null}

        {!checked && !question.reviewKind ? (
          <button
            className="session-hint-button-v3"
            type="button"
            onClick={() => setShowHint((value) => !value)}
          >
            <Lightbulb size={16} />
            {showHint ? "Ẩn gợi ý" : "Cần một gợi ý?"}
          </button>
        ) : null}

        {showHint && !checked && !question.reviewKind ? (
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
                  onClick={() => { setAnswer(choice); submit(undefined, choice); }}
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

        {question.type === "input" && !question.reviewKind ? (
          <div className="input-answer-wrap">
            <input
              autoComplete="off"
              aria-label="Câu trả lời của bạn"
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
              onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
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
                tokens.map((sourceIndex, tokenIndex) => (
                  <button
                    key={sourceIndex}
                    disabled={checked}
                    onClick={() =>
                      setTokens((current) =>
                        current.filter(
                          (_, itemIndex) =>
                            itemIndex !== tokenIndex,
                        ),
                      )
                    }
                  >
                    {question.tokens?.[sourceIndex]}
                  </button>
                ))
              ) : (
                <span>{messages.quiz.reorderHint}</span>
              )}
            </div>

            <div className="token-bank">
              {availableTokenIndexes(question.tokens ?? [], tokens).map(sourceIndex => (
                  <button
                    disabled={checked}
                    key={sourceIndex}
                    onClick={() =>
                      setTokens((current) => [
                        ...current,
                        sourceIndex,
                      ])
                    }
                  >
                    {question.tokens?.[sourceIndex]}
                  </button>
                ))}
            </div>
          </div>
        ) : null}

        {checked ? (
          <div
            role="status"
            aria-live="polite"
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
              {question.audioText ? <p className="korean-text">{question.audioText}</p> : null}
              {question.sourceRef ? <small>Nguồn: {question.sourceRef}</small> : null}
              {mode === "review" && state.mastery[question.id] ? <small>Lần ôn tiếp: {formatReviewDate(state.mastery[question.id].dueAt)}</small> : null}
              {!isCorrect ? (
                <small>
                  Đáp án đúng: <b>{question.answer}</b>
                </small>
              ) : null}
            </div>
          </div>
        ) : null}
        {checked ? <LessonCoach key={question.id} lessonId={question.lessonId} questionId={question.id} compact /> : null}
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

        {question.reviewKind && !checked ? <div className="recall-actions">
          {!showHint ? <button className="primary-button" onClick={() => setShowHint(true)}>Xem đáp án / gợi ý</button> : <>
            <button className="secondary-button" onClick={() => submit(false)}>Cần ôn lại</button>
            <button className="primary-button" onClick={() => submit(true)}>Đã nhớ</button>
          </>}
        </div> : <button
          className="primary-button"
          disabled={!checked && !canSubmit}
          onClick={checked ? next : () => submit()}
        >
          {checked
            ? index === questions.length - 1
              ? messages.quiz.result
              : messages.quiz.continue
            : messages.quiz.check}
          <ArrowRight size={18} />
        </button>}
      </footer>
    </div>
  );
}
