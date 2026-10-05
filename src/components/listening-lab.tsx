"use client";

import { useState } from "react";
import { Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { listeningItems } from "@/data/content";
import { useLearning } from "@/lib/learning-state";

export function ListeningLab() {
  const { recordAnswer } = useLearning();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const item = listeningItems[index];

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
    if (!selected) return;
    setChecked(true);
    recordAnswer("listening", selected === item.answer, item.id);
  }

  function next() {
    setIndex((current) => (current + 1) % listeningItems.length);
    setSelected("");
    setChecked(false);
  }

  return (
    <div className="skill-lab listening-lab">
      <header className="skill-lab-header"><span className="eyebrow">듣기 · LISTENING</span><h1>Nghe ý chính, đừng cố bắt từng chữ</h1><p>Audio demo được phát bằng giọng Korean TTS có sẵn trong trình duyệt.</p></header>
      <section className="audio-stage">
        <div className="audio-icon"><Headphones size={33} /></div>
        <div className="sound-wave">{Array.from({ length: 22 }).map((_, i) => <span key={i} style={{ height: `${18 + ((i * 13) % 42)}%` }} />)}</div>
        <button className="audio-play" onClick={() => play()}>{playing ? <Pause size={22} /> : <Play size={22} />}{playing ? "Đang phát…" : "Nghe câu"}</button>
        <button className="audio-replay" onClick={() => play(0.56)}><RotateCcw size={15} /> Nghe lại chậm</button>
      </section>
      <section className="listening-question"><span>Câu {index + 1}/{listeningItems.length}</span><h2>Câu bạn vừa nghe có nghĩa là gì?</h2>
        <div className="listening-options">{item.choices.map((choice) => { const state = checked ? choice === item.answer ? " correct" : selected === choice ? " wrong" : "" : selected === choice ? " selected" : ""; return <button className={state} disabled={checked} key={choice} onClick={() => setSelected(choice)}>{choice}</button>; })}</div>
        <div className="listening-footer">{checked ? <p className={selected === item.answer ? "good" : "bad"}>{selected === item.answer ? "Đúng rồi! Nghe lại một lần để củng cố." : `Đáp án đúng: ${item.answer}`}</p> : <span />}
          <button className="primary-button" disabled={!selected} onClick={checked ? next : submit}>{checked ? "Câu tiếp theo" : "Kiểm tra"}</button></div>
      </section>
    </div>
  );
}
