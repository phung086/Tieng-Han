"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Gamepad2, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";
import {readPracticeSession,writePracticeSession} from "@/lib/practice-session-storage";
import { arcadeChoices, buildArcadeCards, prioritizeArcade, type ArcadeCard, type ArcadeMode } from "@/lib/review-arcade";
import { matchesSourceAnswer } from "@/lib/textbook-drills";
import { TouchAnswer } from "./touch-answer";
import { ItemIllustrations } from "./learning-illustration";
import styles from "./review-arcade.module.css";

const modes: { id: ArcadeMode; label: string; description: string }[] = [
  { id: "meaning", label: "Bắt nghĩa", description: "Nhìn từ tiếng Hàn, tìm nghĩa tiếng Việt." },
  { id: "recall", label: "Nhớ ngược", description: "Từ nghĩa tiếng Việt, tìm lại từ tiếng Hàn." },
  { id: "grammar", label: "Ghép mẫu câu", description: "Nối cấu trúc với đúng ý nghĩa trong bài." },
  { id: "sentence", label: "Xếp câu", description: "Chạm các mảnh để dựng lại từng ví dụ ngữ pháp." },
];

export function ReviewArcade() {
  const search = useSearchParams();
  const { course, hydrated } = useContent();
  const { state, hydrated: learningReady } = useLearning();
  const requestedLesson = search.get("lesson");
  const requestedMode = search.get("game");
  const [lessonId, setLessonId] = useState(requestedLesson && course.lessons.some(lesson => String(lesson.id) === requestedLesson) ? requestedLesson : "all");
  const [mode, setMode] = useState<ArcadeMode>(modes.find(item => item.id === requestedMode)?.id ?? "meaning");
  const [dueOnly, setDueOnly] = useState(false);
  const [session, setSession] = useState<ArcadeCard[] | null>(null);
  const [round, setRound] = useState(0);
  const all = useMemo(() => buildArcadeCards(course.lessons), [course.lessons]);
  const bank = all.filter(card => card.mode === mode && (lessonId === "all" || card.lessonId === Number(lessonId)));
  const queue = prioritizeArcade(bank, state.mastery, todayKey(), dueOnly);
  if (!hydrated || !learningReady) return <p role="status">Đang mở trò chơi ôn tập…</p>;
  return <section className={styles.arcade} id="review-games" aria-labelledby="review-games-title">
    <header className={styles.header}>
      <Gamepad2 size={30} aria-hidden="true" />
      <div><h2 id="review-games-title">Chơi một chút, nhớ thêm một chút.</h2>
        <p>Không đếm ngược, không mất lượt. Chọn bất kỳ bài nào; mọi từ và ví dụ đã nhập đều có lượt ôn.</p></div>
    </header>
    <div className={styles.controls}>
      <label>Phạm vi ôn<select aria-label="Phạm vi trò chơi" value={lessonId} onChange={event => { setLessonId(event.target.value); setSession(null); }}>
        <option value="all">Toàn bộ giáo trình đang chọn</option>
        {course.lessons.map(lesson => <option value={lesson.id} key={lesson.id}>Bài {lesson.id} · {lesson.vi || lesson.title}</option>)}
      </select></label>
      <label className={styles.check}><input type="checkbox" checked={dueOnly} onChange={event => { setDueOnly(event.target.checked); setSession(null); }} />Chỉ ôn mục yếu / đến hạn</label>
    </div>
    <div className={styles.modes} role="group" aria-label="Chọn trò chơi">
      {modes.map(item => <button type="button" key={item.id} aria-pressed={mode === item.id}
        onClick={() => { setMode(item.id); setSession(null); }}><strong>{item.label}</strong><span>{item.description}</span></button>)}
    </div>
    {session ? <ArcadeSession key={`${course.id}:${round}`} cards={session} all={all} locale={course.language?.locale || "ko-KR"}
      storageKey={`haneul-arcade-v1:${course.id}:${lessonId}:${mode}:${dueOnly}`}
      onRetry={retryCards => { setSession(retryCards); setRound(value => value + 1); }}
      onExit={() => setSession(null)} /> : <div className={styles.start}>
      <p><strong>{queue.length} lượt ôn</strong> · {dueOnly ? "Ưu tiên mục còn yếu hoặc đã đến ngày ôn." : "Mục cần ôn trước, mục mới tiếp theo. Có thể dừng và quay lại."}</p>
      {queue.length ? <button className="primary-button" type="button" onClick={() => { setSession(queue); setRound(value => value + 1); }}>Bắt đầu chơi <ArrowRight size={17} /></button> : <p>Chưa có mục phù hợp. Bỏ bộ lọc đến hạn hoặc chọn trò chơi khác.</p>}
    </div>}
    <small className={styles.sourceNote}>Trò chơi tạo thêm từ dữ liệu bài đã nhập; không phải bài tập nguyên bản hay chứng nhận bao phủ đầy đủ sách. Điểm chơi không khóa bài.</small>
  </section>;
}

type SavedRound = { remaining: string[]; missed: string[]; correct: number; done: number; signature: string };
function restoreRound(input: string | null, cards: ArcadeCard[], signature: string): SavedRound | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(input || "null") as SavedRound | null;
    const ids = new Set(cards.map(card => card.id));
    if (!value || value.signature !== signature || !Array.isArray(value.remaining) || !Array.isArray(value.missed)) return null;
    if (![...value.remaining, ...value.missed].every(id => typeof id === "string" && ids.has(id)) || new Set(value.remaining).size !== value.remaining.length || new Set(value.missed).size !== value.missed.length) return null;
    if (!Number.isSafeInteger(value.done) || !Number.isSafeInteger(value.correct) || value.correct < 0 || value.correct > value.done || value.done + value.remaining.length !== cards.length || value.missed.length !== value.done - value.correct) return null;
    return value;
  } catch { return null; }
}

function ArcadeSession({ cards, all, locale, storageKey, onExit, onRetry }: {
  cards: ArcadeCard[]; all: ArcadeCard[]; locale: string; storageKey: string; onExit: () => void; onRetry: (cards: ArcadeCard[]) => void;
}) {
  const {state,recordAnswer,progressScope,savePracticeSession} = useLearning();
  const { getLesson } = useContent();
  const signature = JSON.stringify(cards.map(card => [card.id, card.answer]).sort((a, b) => a[0].localeCompare(b[0])));
  const [saved] = useState(() => restoreRound(typeof window==="undefined"?null:readPracticeSession(state,window.localStorage,progressScope,storageKey), cards, signature));
  const [remaining, setRemaining] = useState(saved?.remaining ?? cards.map(card => card.id));
  const [missed, setMissed] = useState<string[]>(saved?.missed ?? []);
  const [done, setDone] = useState(saved?.done ?? 0);
  const [correct, setCorrect] = useState(saved?.correct ?? 0);
  const [response, setResponse] = useState("");
  const [checked, setChecked] = useState(false);
  const grading=useRef(false);
  const [combo, setCombo] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const card = cards.find(item => item.id === remaining[0]);
  function save(value: SavedRound) {
    const serialized=JSON.stringify(value);savePracticeSession(storageKey,serialized);
    try { writePracticeSession(window.localStorage,progressScope,storageKey,serialized); } catch { /* Games work without storage. */ }
  }
  function check(answer: string) {
    if (!card || checked || grading.current) return;
    grading.current=true;
    const right = matchesSourceAnswer(answer, card.answer);
    setResponse(answer); setChecked(true); setCombo(value => right ? value + 1 : 0);
    // Recognition and construction both exercise the same knowledge item, not a fabricated lesson completion.
    recordAnswer(card.skill, right, card.knowledgeId);
    setCorrect(value => value + (right ? 1 : 0));
    const nextMissed = right ? missed : [...missed, card.id];
    setMissed(nextMissed);
    // Checkpoint after grading, so leaving during feedback cannot award XP twice on resume.
    save({ remaining: remaining.slice(1), missed: nextMissed, correct: correct + (right ? 1 : 0), done: done + 1, signature });
  }
  function next() {
    if (!checked) return;
    grading.current=false;
    setRemaining(value => value.slice(1)); setDone(value => value + 1);
    setResponse(""); setChecked(false); setAudioError(false);
  }
  function retry() {
    savePracticeSession(storageKey,null);try { writePracticeSession(window.localStorage,progressScope,storageKey,null); } catch { /* optional */ }
    onRetry(cards.filter(item => missed.includes(item.id)));
  }
  if (!card) return <div className={styles.result} role="status">
    <Check size={28} /><h3>Đã đi qua toàn bộ lượt ôn</h3>
    <p>{correct}/{done} lượt nhớ đúng · {missed.length} mục cần gặp lại. Các mục sai được đưa vào lịch ôn.</p>
    <div className={styles.actions}>{missed.length ? <button type="button" className="primary-button" onClick={retry}><RotateCcw size={17} />Chơi lại các mục sai</button> : null}
      <button type="button" className="secondary-button" onClick={() => { savePracticeSession(storageKey,null);try { writePracticeSession(window.localStorage,progressScope,storageKey,null); } catch { /* optional */ } onRetry(cards); }}>Chơi lại toàn bộ</button>
      <button type="button" className="secondary-button" onClick={onExit}>Chọn bài / trò chơi khác</button></div>
  </div>;
  const choices = arcadeChoices(card, all);
  const right = checked && matchesSourceAnswer(response, card.answer);
  return <div className={styles.session}>
    <div className={styles.roundBar}><span>Đã làm {done}/{cards.length} · Bài {card.lessonId}</span><strong>Chuỗi nhớ đúng: {combo}</strong>
      <button type="button" className="text-button" onClick={onExit}>Dừng / đổi bài</button></div>
    <div className={styles.question} key={card.id}>
      {card.skill === "vocabulary" && getLesson(card.lessonId) ? <ItemIllustrations lesson={getLesson(card.lessonId)!} kind="vocabulary" itemId={card.knowledgeId} exactOnly compact /> : null}
      <h3>{card.prompt}</h3>
      {card.mode === "sentence" || choices.length < 2 ? <>
        <TouchAnswer key={card.id} answer={card.answer} disabled={checked} onChange={setResponse} />
        {!checked ? <button className="primary-button" type="button" disabled={!response.trim()} onClick={() => check(response)}>Kiểm tra câu</button> : null}
      </> : <div className={styles.choices}>{choices.map(choice => <button type="button" key={choice}
        disabled={checked} aria-pressed={response === choice} onClick={() => check(choice)}
        className={checked && choice === card.answer ? styles.correct : checked && choice === response ? styles.wrong : ""}>{choice}</button>)}</div>}
      {!checked ? <button type="button" className="text-button" onClick={() => check("")}>Chưa nhớ · xem và ôn lại</button> : null}
      {checked ? <div className={styles.feedback} role="status">
        <strong>{right ? "Nhớ đúng rồi!" : "Gặp lại lần nữa sẽ dễ nhớ hơn."}</strong>
        <p className="korean-text">{card.answer}</p><p>{card.note}</p>
        <div className={styles.actions}><button type="button" className="secondary-button" onClick={() => {
          if (!("speechSynthesis" in window)) { setAudioError(true); return; }
          const text = card.mode === "meaning" || card.mode === "grammar" ? card.prompt : card.answer;
          const utterance = new SpeechSynthesisUtterance(text); utterance.lang = locale; utterance.rate = .78;
          utterance.onerror = () => setAudioError(true);
          window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
        }}><Volume2 size={16} />Nghe tiếng Hàn</button>
          <button type="button" className="primary-button" onClick={next}>Lượt tiếp <ArrowRight size={17} /></button>
          <Link className="text-button" href={(card.skill === "grammar" ? "/grammar" : "/vocabulary") + "?lesson=" + card.lessonId}>Đọc lại bài</Link></div>
        {audioError ? <p>Không phát được âm thanh. Bạn vẫn có thể đọc và tiếp tục chơi.</p> : null}
      </div> : null}
      {card.sourceRef ? <small className={styles.sourceNote}>Nguồn: {card.sourceRef}</small> : null}
    </div>
  </div>;
}
