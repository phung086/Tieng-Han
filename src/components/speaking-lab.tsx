"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mic, MicOff, Play, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

type RecognitionResultEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } };
type RecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function normalize(value: string) {
  return value.replace(/[\s.!?]/g, "");
}

function similarity(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  let hits = 0;
  for (const char of left) if (right.includes(char)) hits += 1;
  return Math.min(100, Math.round((hits / Math.max(left.length, right.length)) * 100));
}

export function SpeakingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const lesson = getLesson(lessonId);
  const sentences = lesson?.speaking ?? [];
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  const target = sentences[index] ?? "";
  const score = useMemo(() => similarity(transcript, target), [transcript, target]);

  if (!lesson || !sentences.length) {
    return <EmptySkillState lessonId={lessonId} skill="Nói" />;
  }

  function playModel(rate = 0.78) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(target);
    utterance.lang = "ko-KR";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function startRecognition() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => RecognitionLike;
      SpeechRecognition?: new () => RecognitionLike;
    };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      setUnsupported(true);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results[0]?.[0]?.transcript ?? "";
      const result = similarity(value, target);
      setTranscript(value);
      setScores((current) => {
        const nextScores = [...current];
        nextScores[index] = result;
        return nextScores;
      });
      recordAnswer("speaking", result >= 75, "speak-" + lessonId + "-" + index);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setTranscript("");
    recognition.start();
  }

  function next() {
    if (index === sentences.length - 1) {
      completeLessonSkill(lessonId, "speaking");
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setTranscript("");
  }

  function restart() {
    setIndex(0);
    setTranscript("");
    setScores([]);
    setFinished(false);
  }

  if (finished) {
    const average = scores.length
      ? Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length)
      : 0;

    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">말하기 · HOÀN THÀNH</span>
        <h1>{unsupported ? "Bạn đã đi hết phần luyện nói" : "Độ khớp trung bình " + average + "%"}</h1>
        <p>Phần Nói của Bài {lessonId} đã được đánh dấu hoàn thành. Điểm nhận dạng chỉ là tín hiệu luyện tập, không phải chấm phát âm chuyên sâu.</p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}><RotateCcw size={16} /> Luyện lại</button>
          <Link className="primary-button" href={"/learn/" + lessonId}>Về bài học</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-lab speaking-lab">
      <header className="skill-lab-header">
        <span className="eyebrow">말하기 · BÀI {lessonId}</span>
        <h1>Nghe mẫu, rồi nói lại theo nhịp của bạn</h1>
        <p>SpeechRecognition là công cụ luyện phản xạ. Khi có audio chuẩn, phần nghe mẫu sẽ dùng audio giáo trình.</p>
      </header>

      <section className="speaking-card">
        <div className="speaking-step">Câu {index + 1}/{sentences.length}</div>
        <h2 className="korean-text">{target}</h2>

        <div className="model-actions">
          <button className="secondary-button" onClick={() => playModel()}><Volume2 size={17} /> Nghe mẫu</button>
          <button className="secondary-button" onClick={() => playModel(0.58)}><Play size={17} /> Nghe chậm</button>
        </div>

        <div className={"mic-orb" + (listening ? " listening" : "")}>
          <button onClick={() => {
            if (listening) {
              recognitionRef.current?.stop();
              setListening(false);
            } else {
              startRecognition();
            }
          }}>
            {listening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          <span>{listening ? "Đang nghe bạn nói…" : "Chạm để bắt đầu nói"}</span>
        </div>

        {unsupported ? (
          <div className="browser-note">
            Trình duyệt này chưa hỗ trợ SpeechRecognition. Bạn vẫn có thể nghe mẫu và shadowing; dùng nút tiếp theo để hoàn thành phiên.
          </div>
        ) : null}

        {transcript ? (
          <div className="speech-result">
            <div><span>Máy nghe được</span><strong className="korean-text">{transcript}</strong></div>
            <div className={score >= 75 ? "speech-score good" : "speech-score"}><strong>{score}%</strong><span>khớp câu</span></div>
          </div>
        ) : null}

        <div className="speaking-bottom">
          <button className="text-button" onClick={() => setTranscript("")}><RotateCcw size={16} /> Thử lại</button>
          <button className="primary-button" disabled={!unsupported && !transcript} onClick={next}>
            {index === sentences.length - 1 ? "Hoàn thành" : "Câu tiếp theo"}
          </button>
        </div>
      </section>
    </div>
  );
}
