"use client";

import { useMemo, useRef, useState } from "react";
import { Mic, MicOff, Play, RotateCcw, Volume2 } from "lucide-react";
import { useLearning } from "@/lib/learning-state";

const sentences = ["저는 학교에 갑니다.", "저는 도서관에서 공부합니다.", "오늘 친구를 만납니다."];
type RecognitionResultEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type RecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: RecognitionResultEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void; };

function normalize(value: string) { return value.replace(/[\s.!?]/g, ""); }
function similarity(a: string, b: string) {
  const left = normalize(a), right = normalize(b);
  if (!left || !right) return 0;
  let hits = 0;
  for (const char of left) if (right.includes(char)) hits += 1;
  return Math.min(100, Math.round((hits / Math.max(left.length, right.length)) * 100));
}

export function SpeakingLab() {
  const { recordAnswer } = useLearning();
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const target = sentences[index];
  const score = useMemo(() => similarity(transcript, target), [transcript, target]);

  function playModel(rate = 0.78) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(target);
    utterance.lang = "ko-KR"; utterance.rate = rate; window.speechSynthesis.speak(utterance);
  }

  function startRecognition() {
    const w = window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike; SpeechRecognition?: new () => RecognitionLike };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) { setUnsupported(true); return; }
    const recognition = new Recognition();
    recognition.lang = "ko-KR"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { const value = event.results[0]?.[0]?.transcript ?? ""; setTranscript(value); recordAnswer("speaking", similarity(value, target) >= 75, `speak-${index}`); };
    recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition; setListening(true); setTranscript(""); recognition.start();
  }

  return (
    <div className="skill-lab speaking-lab">
      <header className="skill-lab-header"><span className="eyebrow">말하기 · SPEAKING</span><h1>Nghe mẫu, rồi nói lại theo nhịp của bạn</h1><p>Trình duyệt sẽ nhận dạng tiếng Hàn và so khớp với câu mục tiêu ngay trên máy.</p></header>
      <section className="speaking-card">
        <div className="speaking-step">Câu {index + 1}/{sentences.length}</div><h2 className="korean-text">{target}</h2>
        <div className="model-actions"><button className="secondary-button" onClick={() => playModel()}><Volume2 size={17} /> Nghe mẫu</button><button className="secondary-button" onClick={() => playModel(0.58)}><Play size={17} /> Nghe chậm</button></div>
        <div className={`mic-orb${listening ? " listening" : ""}`}><button onClick={() => { if (listening) { recognitionRef.current?.stop(); setListening(false); } else startRecognition(); }}>{listening ? <MicOff size={32} /> : <Mic size={32} />}</button><span>{listening ? "Đang nghe bạn nói…" : "Chạm để bắt đầu nói"}</span></div>
        {unsupported ? <div className="browser-note">Trình duyệt này chưa hỗ trợ SpeechRecognition. Hãy dùng Chrome/Edge desktop để chấm phát âm local.</div> : null}
        {transcript ? <div className="speech-result"><div><span>Máy nghe được</span><strong className="korean-text">{transcript}</strong></div><div className={score >= 75 ? "speech-score good" : "speech-score"}><strong>{score}%</strong><span>khớp câu</span></div></div> : null}
        <div className="speaking-bottom"><button className="text-button" onClick={() => setTranscript("")}><RotateCcw size={16} /> Thử lại</button><button className="primary-button" onClick={() => { setIndex((value) => (value + 1) % sentences.length); setTranscript(""); }}>Câu tiếp theo</button></div>
      </section>
    </div>
  );
}
