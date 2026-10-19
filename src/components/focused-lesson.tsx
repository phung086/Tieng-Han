"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Layers3, Volume2 } from "lucide-react";
import type { LessonContent } from "@/data/content";
import { useLearning } from "@/lib/learning-state";
import { GrammarExplanation } from "./grammar-explanation";
import { IllustratedLesson } from "./illustrated-lesson";
import { ItemIllustrations } from "./learning-illustration";
import styles from "./focused-lesson.module.css";

type Position = { stage: string; words: number; grammar: number; dialogue: number };
const groupSize = 6;

export function FocusedLesson({ lesson, speak, onSupplement }: { lesson: LessonContent; speak: (text: string) => void; onSupplement: () => void }) {
  const { state, savePracticeSession } = useLearning();
  const sessionKey = "lesson-path:" + lesson.id;
  const stages = [
    { id: "words", label: "Từ vựng", count: lesson.vocabulary.length },
    { id: "grammar", label: "Mẫu câu", count: lesson.grammar.length },
    { id: "dialogue", label: "Hội thoại", count: lesson.dialogues?.length ?? 0 },
    { id: "practice", label: "Vận dụng", count: 1 },
  ].filter(stage => stage.count);
  const [position, setPosition] = useState<Position>(() => {
    let saved: Partial<Position> = {};
    try { const value = JSON.parse(state.practiceSessions?.[sessionKey] ?? "{}"); if (value && typeof value === "object") saved = value; } catch { /* Start at the first available section. */ }
    const index = (value: unknown, length: number) => typeof value === "number" && Number.isInteger(value) ? Math.max(0, Math.min(value, Math.max(0, length - 1))) : 0;
    return { stage: stages.some(stage => stage.id === saved.stage) ? saved.stage! : stages[0].id, words: index(saved.words, Math.ceil(lesson.vocabulary.length / groupSize)), grammar: index(saved.grammar, lesson.grammar.length), dialogue: index(saved.dialogue, lesson.dialogues?.length ?? 0) };
  });
  const [all, setAll] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [recall, setRecall] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [hiddenRole, setHiddenRole] = useState("");
  const stageIndex = stages.findIndex(stage => stage.id === position.stage);
  const grammar = lesson.grammar[position.grammar];
  const dialogue = lesson.dialogues?.[position.dialogue];
  const words = lesson.vocabulary.slice(position.words * groupSize, (position.words + 1) * groupSize);

  function move(update: Partial<Position>) {
    const next = { ...position, ...update };
    setPosition(next);
    setRevealed([]);
    setHiddenRole("");
    savePracticeSession(sessionKey, JSON.stringify(next));
    requestAnimationFrame(() => { contentRef.current?.focus({ preventScroll: true }); contentRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
  }
  function pager(kind: "words" | "grammar" | "dialogue", count: number, label: string) {
    return <nav className={styles.pager} aria-label={label}>
      <button type="button" aria-label={label + " trước"} disabled={position[kind] === 0} onClick={() => move({ [kind]: position[kind] - 1 })}><ArrowLeft size={18} /></button>
      <label>{label} <select aria-label={label} value={position[kind]} onChange={event => move({ [kind]: Number(event.target.value) })}>{Array.from({ length: count }, (_, index) => <option key={index} value={index}>{index + 1} / {count}</option>)}</select></label>
      <button type="button" aria-label={label + " tiếp"} disabled={position[kind] + 1 >= count} onClick={() => move({ [kind]: position[kind] + 1 })}><ArrowRight size={18} /></button>
    </nav>;
  }

  return <div className={styles.path}>
    <div className={styles.toolbar}><span><BookOpen size={17} /> {all ? "Đọc toàn bộ bài" : "Mỗi lần một phần nhỏ"}</span><button type="button" aria-pressed={all} onClick={() => setAll(value => !value)}><Layers3 size={16} /> {all ? "Học từng chặng" : "Xem toàn bộ"}</button></div>
    {all ? <IllustratedLesson lesson={lesson} speak={speak} onSupplement={onSupplement} /> : <>
      <nav className={styles.steps} aria-label="Các chặng học">{stages.map((stage, index) => <button key={stage.id} type="button" aria-current={position.stage === stage.id ? "step" : undefined} onClick={() => move({ stage: stage.id })}><span>{index + 1}</span>{stage.label}</button>)}</nav>
      <div ref={contentRef} className={styles.content} key={position.stage} tabIndex={-1} aria-label={"Nội dung chặng " + stages[stageIndex].label}>
        {position.stage === "words" ? <section aria-label="Học từ vựng cùng hình">
          <header className={styles.heading}><h2>Nhìn hình. Nghe từ. Nhớ nghĩa.</h2><p>{lesson.vocabulary.length} từ trong bài · mỗi nhóm tối đa {groupSize} từ</p></header>
          <div className={styles.wordTools}><button type="button" aria-pressed={recall} onClick={() => { setRecall(value => !value); setRevealed([]); }}>{recall ? "Hiện nghĩa" : "Che nghĩa để tự nhớ"}</button><Link href={"/vocabulary?lesson=" + lesson.id}>Ôn bằng flashcard</Link></div>
          <div className={styles.words}>{words.map(word => <article className={styles.word} key={word.id}>
            <ItemIllustrations lesson={lesson} kind="vocabulary" itemId={word.id} exactOnly />
            <div className={styles.wordTitle}><h3 className="korean-text">{word.targetText || word.ko}</h3><button type="button" aria-label={"Nghe từ " + word.ko} onClick={() => speak(word.targetText || word.ko)}><Volume2 size={19} /></button></div>
            <button className={styles.meaning} type="button" aria-expanded={!recall || revealed.includes(word.id)} onClick={() => { if (!recall) { setRecall(true); setRevealed(words.filter(item => item.id !== word.id).map(item => item.id)); } else setRevealed(values => values.includes(word.id) ? values.filter(id => id !== word.id) : [...values, word.id]); }}>{!recall || revealed.includes(word.id) ? word.learnerMeaning || word.vi : "Hiện nghĩa để kiểm tra"}</button>
            {word.example ? <p className="korean-text">{word.example}</p> : null}
          </article>)}</div>
          {pager("words", Math.ceil(lesson.vocabulary.length / groupSize), "Nhóm từ")}
        </section> : null}
        {position.stage === "grammar" && grammar ? <section aria-label="Học ngữ pháp cùng hình">
          <header className={styles.heading}><h2>Hiểu một mẫu, dùng được ngay.</h2><p>{lesson.grammar.length} mẫu câu · chọn mẫu bạn muốn học</p></header>
          <nav className={styles.topics} aria-label="Chọn mẫu câu">{lesson.grammar.map((item, index) => <button type="button" key={item.id} aria-pressed={position.grammar === index} onClick={() => move({ grammar: index })}>{item.pattern}</button>)}</nav>
          <article className={styles.grammar}><h3 className="korean-text">{grammar.pattern}</h3><ItemIllustrations lesson={lesson} kind="grammar" itemId={grammar.id} /><GrammarExplanation key={grammar.id} item={grammar} onSpeak={speak} guided practiceHref={"/practice/quiz?lesson=" + lesson.id + "&mode=guided&skill=grammar"} /></article>
          {pager("grammar", lesson.grammar.length, "Mẫu câu")}
        </section> : null}
        {position.stage === "dialogue" && dialogue ? <section aria-label="Luyện hội thoại theo vai">
          <header className={styles.heading}><h2>{dialogue.title || "Đặt mình vào cuộc hội thoại"}</h2><p>Nghe một lượt, chọn vai và thử tự nhớ câu.</p></header>
          <ItemIllustrations lesson={lesson} kind="dialogue" itemId={dialogue.id} />
          <label className={styles.role}>Nhập vai <select value={hiddenRole} onChange={event => { setHiddenRole(event.target.value); setRevealed([]); }}><option value="">Đọc tất cả các lượt</option>{[...new Set(dialogue.lines.map(line => line.speaker).filter(Boolean))].map(speaker => <option key={speaker} value={speaker}>Ẩn lời của {speaker}</option>)}</select></label>
          <div className={styles.turns}>{dialogue.lines.map((line, index) => <div key={index}><strong>{line.speaker || index + 1}</strong><div>{hiddenRole && line.speaker === hiddenRole && !revealed.includes(String(index)) ? <button type="button" onClick={() => setRevealed(values => [...values, String(index)])}>Tự nhẩm, rồi xem câu</button> : <button className="korean-text" type="button" onClick={() => speak(line.targetText || line.ko)}><Volume2 size={16} />{line.targetText || line.ko}</button>}{line.learnerMeaning || line.vi ? <p>{line.learnerMeaning || line.vi}</p> : null}</div></div>)}</div>
          {pager("dialogue", lesson.dialogues!.length, "Hội thoại")}
        </section> : null}
        {position.stage === "practice" ? <section aria-label="Vận dụng bài học"><header className={styles.heading}><h2>Thử nhớ lại, rồi dùng theo cách của bạn.</h2><p>Chọn một cách luyện hôm nay. Có thể dừng và quay lại bất cứ lúc nào.</p></header><div className={styles.practice}><Link className="primary-button" href={"/practice/quiz?lesson=" + lesson.id + "&mode=quick"}>Ôn nhanh 5 câu <ArrowRight size={18} /></Link><Link href={"/practice?lesson=" + lesson.id + "#review-games"}>Chơi ghép từ và xếp câu</Link><Link href={"/practice/workbook?lesson=" + lesson.id}>Sổ luyện toàn bộ bài</Link>{lesson.reading ? <Link href={"/reading?lesson=" + lesson.id}>Đọc và hiểu</Link> : null}{lesson.listening.length ? <Link href={"/listening?lesson=" + lesson.id}>Nghe và nhận ra câu</Link> : null}{lesson.writing ? <Link href={"/writing?lesson=" + lesson.id}>Thử viết một đoạn</Link> : null}<button type="button" onClick={onSupplement}>Phát âm, văn hóa và bài học mở rộng</button></div></section> : null}
      </div>
      <footer className={styles.footer}><button type="button" disabled={stageIndex === 0} onClick={() => move({ stage: stages[stageIndex - 1].id })}><ArrowLeft size={17} /> Chặng trước</button>{stageIndex + 1 < stages.length ? <button className={styles.next} type="button" onClick={() => move({ stage: stages[stageIndex + 1].id })}>{stages[stageIndex + 1].label} <ArrowRight size={17} /></button> : <Link href="/learn">Chọn bài khác <ArrowRight size={17} /></Link>}</footer>
    </>}
  </div>;
}
