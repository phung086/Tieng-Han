"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mic, MicOff, Play, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";
import { speechMatchScore } from "@/lib/speech-match";
import { useAutoAdvance } from "@/lib/use-auto-advance";
import { SessionFlowControl } from "@/components/session-flow-control";

type RecognitionResultEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

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

export function SpeakingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson, course } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const sentences = lesson?.speaking ?? [];
  const [index, setIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [manualPractice, setManualPractice] = useState<number[]>([]);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const transitionLock = useRef<number | null>(null);

  const target = sentences[index] ?? "";
  const nextStep = getNextLessonFlowStep(lessonId, "speaking");
  const score = useMemo(
    () => speechMatchScore(transcript, target),
    [transcript, target],
  );
  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) { recognition.onresult = null; recognition.onend = null; recognition.onerror = null; recognition.stop(); }
    window.speechSynthesis?.cancel();
  }, []);
  const flow = useAutoAdvance(index, !finished && !listening && !unsupported && scores[index] !== undefined && scores[index] >= 75, next);

  if (!lesson || !sentences.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.speaking}
      />
    );
  }

  function playModel(rate = 0.78) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(target);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function startRecognition() {
    const browserWindow = window as unknown as {
      webkitSpeechRecognition?: new () => RecognitionLike;
      SpeechRecognition?: new () => RecognitionLike;
    };

    const Recognition =
      browserWindow.SpeechRecognition ??
      browserWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setUnsupported(true);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = course.language?.locale ?? "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results[0]?.[0]?.transcript ?? "";
      const result = speechMatchScore(value, target);

      setTranscript(value);
      setScores((current) => {
        const nextScores = [...current];
        nextScores[index] = result;
        return nextScores;
      });

      recordAnswer(
        "speaking",
        result >= 75,
        "speak-" + lessonId + "-" + index,
      );
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setSpeechError("Chưa nhận dạng được giọng nói. Kiểm tra quyền micro hoặc chọn tự luyện."); };
    recognitionRef.current = recognition;

    setListening(true);
    setTranscript("");
    try { recognition.start(); }
    catch { setListening(false); setSpeechError("Chưa mở được micro. Bạn có thể chọn tự luyện và xác nhận từng câu."); }
  }

  function next() {
    if (transitionLock.current === index) return;
    const recognition = recognitionRef.current;
    if (recognition) { recognition.onresult = null; recognition.onend = null; recognition.onerror = null; recognition.stop(); }
    window.speechSynthesis?.cancel();
    if (unsupported ? !manualPractice.includes(index) : scores[index] === undefined) return;
    transitionLock.current = index;
    if (index === sentences.length - 1) {
      const average = scores.length
        ? Math.round(
            scores.reduce((sum, item) => sum + item, 0) / sentences.length,
          )
        : 0;

      if ((unsupported && manualPractice.length === sentences.length) || (!unsupported && scores.filter(Number.isFinite).length === sentences.length && average >= 75)) {
        completeLessonSkill(lessonId, "speaking");
      }
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setTranscript("");
  }

  function restart() {
    transitionLock.current = null;
    flow.reset();
    setIndex(0);
    setTranscript("");
    setScores([]);
    setManualPractice([]);
    setFinished(false);
  }

  if (finished) {
    const average = scores.length
      ? Math.round(
            scores.reduce((sum, item) => sum + item, 0) / sentences.length,
        )
      : 0;
    const passed = unsupported ? manualPractice.length === sentences.length : scores.filter(Number.isFinite).length === sentences.length && average >= 75;

    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">{messages.speaking.complete}</span>
        <h1>
          {unsupported
            ? messages.speaking.completedFallback
            : messages.speaking.averagePrefix + " " + average + "%"}
        </h1>
        <p>
          {passed
            ? unsupported
              ? "Bạn đã xác nhận tự luyện từng câu. Haneul ghi nhận lượt shadowing, không chấm phát âm."
              : "Bạn đạt " + average + "% độ khớp và đủ điều kiện hoàn thành chặng Nói."
            : "Bạn đang ở " + average + "%. Hãy nghe mẫu chậm và thử lại để đạt tối thiểu 75%."}
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={16} /> {messages.speaking.retry}
          </button>
          {passed ? (
            <Link className="primary-button" href={nextStep.href}>
              Tiếp: {nextStep.label}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="skill-lab speaking-lab">
      <SessionFlowControl flow={flow} stepKey={index} />
      <header className="skill-lab-header">
        <span className="eyebrow">
          {messages.skills.speaking.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
        </span>
        <h1>{messages.speaking.title}</h1>
        <p>{messages.speaking.intro}</p>
        <p>Giọng mẫu do thiết bị tổng hợp. Điểm đo độ khớp văn bản nhận dạng, không đánh giá ngữ điệu hay chất lượng phát âm.</p>
      </header>

      <section className="speaking-card">
        <div className="speaking-step">
          {messages.speaking.sentence} {index + 1}/{sentences.length}
        </div>

        <h2 className="korean-text">{target}</h2>

        <div className="model-actions">
          <button
            className="secondary-button"
            onClick={() => playModel()}
          >
            <Volume2 size={17} /> {messages.speaking.model}
          </button>
          <button
            className="secondary-button"
            onClick={() => playModel(0.58)}
          >
            <Play size={17} /> {messages.speaking.slow}
          </button>
        </div>

        <div className={"mic-orb" + (listening ? " listening" : "")}>
          <button
            aria-label={listening ? "Dừng nhận dạng giọng nói" : "Bắt đầu nhận dạng giọng nói"}
            disabled={unsupported}
            onClick={() => {
              if (listening) {
                recognitionRef.current?.stop();
                setListening(false);
              } else {
                startRecognition();
              }
            }}
          >
            {listening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          <span>
            {listening
              ? messages.speaking.listening
              : messages.speaking.tap}
          </span>
        </div>

        {unsupported ? (
          <div className="browser-note">
            {messages.speaking.unsupported}
          </div>
        ) : null}
        {speechError ? <p role="alert">{speechError}</p> : null}
        {!unsupported ? <button className="text-button" type="button" onClick={() => { recognitionRef.current?.stop(); setListening(false); restart(); setUnsupported(true); setSpeechError(""); }}>Tự luyện từng câu khi chưa dùng được micro</button> : <button className="secondary-button" type="button" disabled={manualPractice.includes(index)} onClick={() => {
          setManualPractice(current => [...current, index]);
          recordAnswer("speaking", true, `speak-${lessonId}-${index}`);
        }}>{manualPractice.includes(index) ? "Đã xác nhận lượt tự luyện" : "Tôi đã nghe mẫu và đọc lại câu này"}</button>}

        {transcript ? (
          <div className="speech-result">
            <div>
              <span>{messages.speaking.heard}</span>
              <strong className="korean-text">{transcript}</strong>
            </div>
            <div
              className={
                score >= 75
                  ? "speech-score good"
                  : "speech-score"
              }
            >
              <strong>{score}%</strong>
              <span>{messages.speaking.match}</span>
            </div>
          </div>
        ) : null}

        <div className="speaking-bottom">
          <button
            className="text-button"
            onClick={() => setTranscript("")}
          >
            <RotateCcw size={16} /> {messages.speaking.retry}
          </button>
          <button
            className="primary-button"
            disabled={listening || (unsupported ? !manualPractice.includes(index) : scores[index] === undefined)}
            onClick={next}
          >
            {index === sentences.length - 1
              ? messages.common.finish
              : messages.speaking.next}
          </button>
        </div>
      </section>
    </div>
  );
}
