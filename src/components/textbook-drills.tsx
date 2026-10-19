"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, Headphones, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import {
  buildTextbookDrills,
  countDrillModes,
  matchesSourceAnswer,
  type DrillMode,
  type TextbookDrill,
} from "@/lib/textbook-drills";
import styles from "./textbook-drills.module.css";
import { TouchAnswer } from "./touch-answer";

const modes: Array<{ id: DrillMode; title: string; description: string }> = [
  { id: "cloze", title: "Điền từ", description: "Điền từ vựng và mẫu ngữ pháp vào chỗ trống." },
  { id: "translation", title: "Luyện dịch", description: "Dịch từng lời thoại sang tiếng Hàn theo câu mẫu sách." },
  { id: "dictation", title: "Nghe chép", description: "Nghe và gõ lại từng câu nguồn, không nhìn trước đáp án." },
];

type SessionState = {
  index: number;
  correct: number;
  missed: string[];
};

function fingerprint(items: TextbookDrill[]): string {
  const serialized = JSON.stringify(items.map(item => [item.id, item.answer, item.prompt]));
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return String(hash >>> 0);
}

function readSavedSession(key: string, signature: string, items: TextbookDrill[]): SessionState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    if (record.signature !== signature) return null;
    const index = record.index;
    const correct = record.correct;
    const missed = record.missed;
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || index > items.length) return null;
    if (typeof correct !== "number" || !Number.isSafeInteger(correct) || correct < 0 || correct > index) return null;
    if (!Array.isArray(missed) || missed.length > index) return null;
    const ids = new Set(items.slice(0, index).map(item => item.id));
    if (!missed.every(id => typeof id === "string" && ids.has(id))) return null;
    if (correct + missed.length !== index) return null;
    return { index, correct, missed };
  } catch {
    return null;
  }
}

export function TextbookDrills({ requestedLessonId }: { requestedLessonId?: number }) {
  const { course, hydrated } = useContent();
  const [chosenLesson, setChosenLesson] = useState<number | null>(null);
  const [mode, setMode] = useState<DrillMode>("cloze");
  const lessonId = chosenLesson ?? requestedLessonId ?? course.lessons[0]?.id;
  const lesson = course.lessons.find(item => item.id === lessonId);
  const bank = useMemo(() => lesson ? buildTextbookDrills(lesson) : [], [lesson]);
  const counts = countDrillModes(bank);

  if (!hydrated) return <div className={styles.empty}>Đang tải giáo trình đã nhập…</div>;
  if (!lesson) {
    return (
      <section className={styles.empty}>
        <h1>Chưa có bài học để luyện</h1>
        <p>Hãy chọn hoặc nhập một giáo trình trước. Bài luyện sẽ lấy dữ liệu trực tiếp từ giáo trình đó.</p>
        <Link className="primary-button" href="/learn">Về giáo trình</Link>
      </section>
    );
  }

  const drills = bank.filter(item => item.mode === mode);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PRACTICE STUDIO · GIÁO TRÌNH THỰC TẾ</span>
          <h1>Luyện theo dạng bài</h1>
          <p>Không lấy ngẫu nhiên 10 câu. Mọi câu ở đây được dựng từ từ mới, ví dụ, hội thoại và bài nghe đã nhập trong khóa học.</p>
        </div>
        <Link href="/practice" className="secondary-button"><ArrowLeft size={16} /> Về luyện tập</Link>
      </header>
      <div className={styles.toolbar}>
        <label htmlFor="drill-lesson-select">Chọn bài học</label>
        <select
          id="drill-lesson-select"
          className={styles.select}
          value={lesson.id}
          onChange={event => setChosenLesson(Number(event.target.value))}
        >
          {course.lessons.map(item => (
            <option key={item.id} value={item.id}>Bài {item.id} · {item.vi || item.title}</option>
          ))}
        </select>
        <span className={styles.total}>{bank.length} lượt luyện từ Bài {lesson.id}</span>
      </div>
      <div className={styles.modes} role="group" aria-label="Chọn dạng bài ôn">
        {modes.map(item => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? styles.modeActive : styles.mode}
            onClick={() => setMode(item.id)}
            aria-pressed={mode === item.id}
          >
            <strong>{item.title}</strong>
            <span>{counts[item.id]} câu</span>
          </button>
        ))}
      </div>
      <p className={styles.description}>{modes.find(item => item.id === mode)?.description}</p>
      {drills.length ? (
        <DrillSession
          key={course.id + ":" + lesson.id + ":" + mode}
          courseId={course.id}
          lessonId={lesson.id}
          mode={mode}
          items={drills}
          locale={course.language?.locale ?? "ko-KR"}
        />
      ) : (
        <section className={styles.empty}>
          <BookOpenText size={32} />
          <h2>Chưa có câu cho dạng bài này</h2>
          <p>Phần này cần dữ liệu nguồn tương ứng. Các dạng bài khác vẫn hoạt động bình thường.</p>
          <Link href={"/practice/workbook?lesson=" + lesson.id} className="secondary-button">Xem toàn bộ sổ bài học</Link>
        </section>
      )}
      <footer className={styles.footer}>
        <Link className="secondary-button" href={"/practice/workbook?lesson=" + lesson.id}>
          Xem tất cả mục của bài trong Sổ luyện nguồn <ArrowRight size={16} />
        </Link>
        <p>Bài dịch so với câu mẫu đã nhập, không chấm mọi cách diễn đạt tương đương. Bản dịch Việt bổ trợ được ghi nhãn riêng.</p>
      </footer>
    </div>
  );
}

function DrillSession({
  courseId, lessonId, mode, items, locale,
}: {
  courseId: string;
  lessonId: number;
  mode: DrillMode;
  items: TextbookDrill[];
  locale: string;
}) {
  const { recordAnswer } = useLearning();
  const signature = useMemo(() => fingerprint(items), [items]);
  const storageKey = ["haneul-drill-progress-v1", encodeURIComponent(courseId), lessonId, mode].join(":");
  const [progress, setProgress] = useState<SessionState>({ index: 0, correct: 0, missed: [] });
  const [response, setResponse] = useState("");
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<"right" | "wrong" | "skipped" | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [touchInput, setTouchInput] = useState(false);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const saved = readSavedSession(storageKey, signature, items);
      if (saved) {
        setProgress(saved);
        setRestored(saved.index > 0);
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [storageKey, signature, items]);

  const item = items[progress.index];
  const completed = progress.index >= items.length;
  const percent = Math.round((progress.index / items.length) * 100);

  function speak(slow = false) {
    if (!item?.audioText) return;
    if (!("speechSynthesis" in window)) {
      setAudioError(true);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(item.audioText);
    utterance.lang = locale;
    utterance.rate = slow ? 0.65 : 0.84;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setAudioError(false);
  }

  function evaluate(skipped = false) {
    if (!item || checked || (!response.trim() && !skipped)) return;
    const right = !skipped && matchesSourceAnswer(response, item.answer);
    setResult(skipped ? "skipped" : right ? "right" : "wrong");
    setChecked(true);
    recordAnswer(item.skill, right, item.id);
  }

  function next() {
    if (!item || !checked) return;
    const right = result === "right";
    const nextProgress: SessionState = {
      index: progress.index + 1,
      correct: progress.correct + (right ? 1 : 0),
      missed: right ? progress.missed : [...progress.missed, item.id],
    };
    setProgress(nextProgress);
    setResponse("");
    setChecked(false);
    setResult(null);
    setShowHint(false);
    setAudioError(false);
    setRestored(false);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...nextProgress, signature }));
    } catch { /* Browser may deny storage; session remains usable. */ }
  }

  function restart() {
    setProgress({ index: 0, correct: 0, missed: [] });
    setResponse("");
    setChecked(false);
    setResult(null);
    setShowHint(false);
    setRestored(false);
    try { window.localStorage.removeItem(storageKey); } catch { /* optional */ }
  }

  if (!ready) return <div className={styles.empty}>Đang khôi phục phiên luyện…</div>;

  if (completed) {
    return (
      <section className={styles.card}>
        <CheckCircle2 size={38} />
        <span className={styles.eyebrow}>ĐÃ HOÀN THÀNH DẠNG BÀI</span>
        <h2>{progress.correct}/{items.length} câu khớp câu mẫu</h2>
        <p>{progress.missed.length} câu cần xem lại. Hãy xem lại các câu mẫu rồi làm lại lượt này.</p>
        <div className={styles.actions}>
          <button type="button" className="primary-button" onClick={restart}>
            <RotateCcw size={16} /> Luyện lại toàn bộ
          </button>
          <Link className="secondary-button" href={"/practice/workbook?lesson=" + lessonId}>Mở sổ bài học</Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.progressHeader}>
        <strong>Câu {progress.index + 1} / {items.length}</strong>
        <span>{progress.correct} câu khớp · {percent}% đã làm</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label="Tiến độ luyện tập" aria-valuenow={progress.index} aria-valuemin={0} aria-valuemax={items.length}>
        <span style={{ width: percent + "%" }} />
      </div>
      {restored ? <p className={styles.saved}>Đã khôi phục lượt luyện trước, tiếp tục từ câu {progress.index + 1}.</p> : null}
      <div className={styles.question}>
        <span className={styles.eyebrow}>{item.title}</span>
        <h2 className={styles.prompt}>{item.prompt}</h2>
        {item.context ? <p>{item.context}</p> : null}
        {item.audioText ? (
          <div className={styles.actions}>
            <button type="button" className="secondary-button" onClick={() => speak()}>
              <Volume2 size={16} /> Nghe câu
            </button>
            <button type="button" className="secondary-button" onClick={() => speak(true)}>
              <Headphones size={16} /> Nghe chậm
            </button>
          </div>
        ) : null}
        {audioError ? <p role="status">Thiết bị không hỗ trợ đọc tiếng Hàn tự động. Có thể bỏ qua câu này và học bằng Sổ luyện nguồn.</p> : null}
        <label className={styles.answerLabel} htmlFor="textbook-drill-answer">Câu trả lời của bạn</label>
        <button type="button" className="secondary-button" disabled={checked} onClick={() => { setTouchInput(value => !value); setResponse(""); }}>
          {touchInput ? "Chuyển sang tự gõ" : "Không có bàn phím tiếng Hàn · chạm để xếp"}
        </button>
        {touchInput ? <TouchAnswer key={item.id} answer={item.answer} disabled={checked} onChange={setResponse} /> : <textarea
          id="textbook-drill-answer"
          className={styles.textarea}
          value={response}
          onChange={event => setResponse(event.target.value)}
          disabled={checked}
          placeholder={item.mode === "translation" ? "Viết bằng tiếng Hàn…" : "Nhập câu trả lời…"}
          rows={2}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!checked) evaluate();
              else next();
            }
          }}
        />}
        {!checked ? (
          <>
            <button className={styles.hint} type="button" onClick={() => setShowHint(value => !value)}>
              {showHint ? "Ẩn gợi ý" : "Hiện gợi ý"}
            </button>
            {showHint && item.hint ? <p className={styles.hintText}>{item.hint}</p> : null}
          </>
        ) : (
          <div className={result === "right" ? styles.feedbackRight : styles.feedbackWrong} role="status">
            <strong>{result === "right" ? "Khớp câu mẫu!" : result === "skipped" ? "Đã bỏ qua câu này" : "Chưa khớp câu mẫu"}</strong>
            <p>Câu mẫu để đối chiếu: <span className="korean-text">{item.answer}</span></p>
            {item.mode === "translation" ? <small>Các bản dịch đúng khác có thể được chấp nhận khi giáo viên đánh giá.</small> : null}
          </div>
        )}
        {item.sourceRef ? <small className={styles.ref}>Nguồn: {item.sourceRef}</small> : null}
        <div className={styles.actions}>
          {checked ? (
            <button className="primary-button" type="button" onClick={next}>
              {progress.index === items.length - 1 ? "Xem kết quả" : "Câu tiếp theo"} <ArrowRight size={16} />
            </button>
          ) : (
            <>
              <button className="primary-button" type="button" disabled={!response.trim()} onClick={() => evaluate()}>
                Kiểm tra câu trả lời
              </button>
              <button className="secondary-button" type="button" onClick={() => evaluate(true)}>Bỏ qua / xem đáp án</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
