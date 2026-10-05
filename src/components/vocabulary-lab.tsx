"use client";

import { useState } from "react";
import { RotateCcw, Shuffle, Volume2 } from "lucide-react";
import { vocabDeck } from "@/data/content";
import { useLearning } from "@/lib/learning-state";

export function VocabularyLab() {
  const { recordAnswer } = useLearning();
  const [order, setOrder] = useState(vocabDeck.map((_, index) => index));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const card = vocabDeck[order[position]];
  const progress = Math.round(((position + 1) / order.length) * 100);

  function speak() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.ko);
    utterance.lang = "ko-KR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function rate(correct: boolean) {
    recordAnswer("vocabulary", correct, card.id);
    if (correct) setKnown((value) => value + 1);
    if (position === order.length - 1) setPosition(0);
    else setPosition((value) => value + 1);
    setRevealed(false);
  }

  function shuffle() {
    setOrder((current) => [...current].sort(() => Math.random() - 0.5));
    setPosition(0);
    setRevealed(false);
  }

  return (
    <div className="lab-page">
      <header className="lab-header"><div><span className="eyebrow">FLASHCARD · BÀI 3</span><h1>Từ vựng</h1><p>{revealed ? "Chọn mức độ nhớ thật của bạn" : "Thử nhớ nghĩa trước khi lật thẻ"}</p></div>
        <div className="lab-actions"><button className="secondary-button" onClick={shuffle}><Shuffle size={16} /> Xáo trộn</button><button className="icon-button" onClick={() => { setPosition(0); setKnown(0); setRevealed(false); }}><RotateCcw size={17} /></button></div></header>
      <div className="lab-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className={`flashcard${revealed ? " revealed" : ""}`} onClick={() => setRevealed((value) => !value)} role="button" tabIndex={0}>
        <span className="flash-index">{position + 1} / {order.length}</span>
        <button className="sound-button" onClick={(event) => { event.stopPropagation(); speak(); }} type="button" aria-label="Nghe phát âm"><Volume2 size={20} /></button>
        <div className="flash-front"><strong>{card.ko}</strong><span>Chạm để xem nghĩa</span></div>
        <div className="flash-back"><strong>{card.vi}</strong><p className="korean-text">{card.example}</p><span>Chạm để quay lại từ</span></div>
      </div>
      <div className="memory-actions">
        <button disabled={!revealed} className="memory-button learning" onClick={() => rate(false)}><span>↻</span><strong>Chưa nhớ</strong><small>Gặp lại sớm</small></button>
        <button disabled={!revealed} className="memory-button known" onClick={() => rate(true)}><span>✓</span><strong>Đã nhớ</strong><small>Giãn thời gian ôn</small></button>
      </div>
      <div className="lab-meta"><span>{known} từ đã nhớ trong phiên này</span><span>{order.length - position} lượt còn lại</span></div>
    </div>
  );
}
