"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

export function ListeningLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const lesson = getLesson(lessonId);
  const items = lesson?.listening ?? [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!lesson || !items.length) return <EmptySkillState lessonId={lessonId} skill="Nghe" />;

  const item = items[index];

  function play(rate = 0.72) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = "ko-KR";
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
    setIndex(0); setSelected(""); setChecked(false); setCorrectCount(0); setFinished(false);
  }

  if (finished) {
    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div><span className="eyebrow">듣기 · HOÀN THÀNH</span>
        <h1>{correctCount}/{items.length} câu nghe đúng</h1><p>Phần Nghe của Bài {lessonId} đã hoàn thành và kết quả đã được lưu local.</p>
        <div className="complete-actions"><button className="secondary-button" onClick={restart}><RotateCcw size={16} /> Nghe lại</button><Link className="primary-button" href={"/learn/" + lessonId}>Về bài học</Link></div>
      </div>
    );
  }

  return (
    <div className="skill-lab listening-lab">
      <header className="skill-lab-header"><span className="eyebrow">듣기 · BÀI {lessonId}</span><h1>Nghe ý chính, đừng cố bắt từng chữ</h1><p>Khi có audio giáo trình thật, player này sẽ dùng file audio thay cho TTS mà không đổi workflow.</p></header>
      <section className="audio-stage"><div className="audio-icon"><Headphones size={33} /></div><div className="sound-wave">{Array.from({ length: 22 }).map((_, i) => <span key={i} style={{ height: 18 + ((i * 13) % 42) + "%" }} />)}</div><button className="audio-play" onClick={() => play()}>{playing ? <Pause size={22} /> : <Play size={22} />}{playing ? "Đang phát…" : "Nghe câu"}</button><button className="audio-replay" onClick={() => play(0.56)}><RotateCcw size={15} /> Nghe lại chậm</button></section>
      <section className="listening-question"><span>Câu {index + 1}/{items.length}</span><h2>Câu bạn vừa nghe có nghĩa là gì?</h2>
        <div className="listening-options">{item.choices.map((choice) => { const state = checked ? choice === item.answer ? " correct" : selected === choice ? " wrong" : "" : selected === choice ? " selected" : ""; return <button className={state} disabled={checked} key={choice} onClick={() => setSelected(choice)}>{choice}</button>; })}</div>
        <div className="listening-footer">{checked ? <p className={selected === item.answer ? "good" : "bad"}>{selected === item.answer ? "Đúng rồi! Nghe lại một lần để củng cố." : "Đáp án đúng: " + item.answer}</p> : <span />}<button className="primary-button" disabled={!selected} onClick={checked ? next : submit}>{checked ? index === items.length - 1 ? "Hoàn thành" : "Câu tiếp theo" : "Kiểm tra"}</button></div>
      </section>
    </div>
  );
}
