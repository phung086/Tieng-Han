"use client";
import {useAutoAdvance} from "@/lib/use-auto-advance";
import {SessionFlowControl} from "./session-flow-control";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {speechMatchScore as similarity} from "@/lib/speech-match";
import { CheckCircle2, Mic, MicOff, Play, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";


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
  const [manual, setManual] = useState(false);
  const [recognitionError, setRecognitionError] = useState(false);
  const [finished, setFinished] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (autoAdvanceTimerRef.current) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const target = sentences[index] ?? "";
  const nextStep = getNextLessonFlowStep(lessonId, "speaking");
  const score = similarity(transcript, target);

  const flow=useAutoAdvance(index,!finished&&!listening&&!manual&&!unsupported&&scores[index]!==undefined&&scores[index]>=75,next);

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
    setRecognitionError(false);
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
    setUnsupported(false);
    setManual(false);
    recognition.lang = course.language?.locale ?? "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const value = event.results[0]?.[0]?.transcript ?? "";
      const result = similarity(value, target);
      const nextScores = [...scores];
      nextScores[index] = result;

      setTranscript(value);
      setScores(nextScores);

      recordAnswer(
        "speaking",
        result >= 75,
        "speak-" + lessonId + "-" + index,
      );

    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setRecognitionError(true); };
    recognitionRef.current = recognition;

    setListening(true);
    setTranscript("");
    try { recognition.start(); }
    catch { setListening(false); setRecognitionError(true); }
  }

  function next(effectiveScores = scores) {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (index === sentences.length - 1) {
      const average = Math.round(sentences.reduce((sum, _, i) => sum + (effectiveScores[i] ?? 0), 0) / sentences.length);

      if (!manual && !unsupported && average >= 75) {
        completeLessonSkill(lessonId, "speaking");
      }
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setTranscript("");
  }

  function restart() {
    if (recognitionRef.current) { recognitionRef.current.onresult = null; recognitionRef.current.stop(); recognitionRef.current = null; }
    setListening(false);
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIndex(0);
    setTranscript("");
    setScores([]);
    setFinished(false);
  }

  if (finished) {
    const average = Math.round(sentences.reduce((sum, _, i) => sum + (scores[i] ?? 0), 0) / sentences.length);

    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">{messages.speaking.complete}</span>
        <h1>
          {unsupported || manual
            ? "Đã kết thúc lượt tự luyện"
            : messages.speaking.averagePrefix + " " + average + "%"}
        </h1>
        <p>
          {unsupported || manual
            ? "Bạn đã tự luyện theo câu mẫu; chưa có điểm phát âm được xác minh. Có thể học tiếp ngay và quay lại thu âm khi thuận tiện."
            : "Độ khớp các câu đã chấm: " + average + "%. Bạn có thể ôn lại hoặc học tiếp bất cứ lúc nào."}
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restart}>
            <RotateCcw size={16} /> {messages.speaking.retry}
          </button>
            <Link className="primary-button" href={nextStep.href}>
              Tiếp: {nextStep.label}
            </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-lab speaking-lab">
      <header className="skill-lab-header">
        <span className="eyebrow">
          {messages.skills.speaking.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
        </span>
        <h1>{messages.speaking.title}</h1>
        <p>{messages.speaking.intro}</p>
      </header>

      <SessionFlowControl flow={flow} stepKey={index} />
      <section className="speaking-card">
        <div className="speaking-step">
          {messages.speaking.sentence} {index + 1}/{sentences.length}
        </div>

        <h2 className="korean-text">{target}</h2>

        <div className="model-actions">
          <button className="secondary-button" type="button" onClick={() => {
            if (recognitionRef.current) { recognitionRef.current.onresult = null; recognitionRef.current.stop(); }
            setListening(false); setManual(true);
            if (autoAdvanceTimerRef.current) window.clearTimeout(autoAdvanceTimerRef.current);
          }}>Không dùng mic · tự luyện</button>
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
        {recognitionError ? <p className="browser-note" role="status">Chưa thu được giọng nói. Thử lại hoặc chọn tự luyện; bạn vẫn chuyển câu và chuyển bài bình thường.</p> : null}
        {manual ? <p className="browser-note" role="status">Đọc theo câu mẫu hoặc nghe rồi nhắc lại khi thuận tiện. Tự luyện không được tính là điểm phát âm đã chấm.</p> : null}

        {transcript ? (
          <div className="speech-result" aria-live="polite" role="status">
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
            className={
              "primary-button" +
              (transcript && score >= 75 ? " auto-advance-button-v3" : "")
            }
            onClick={() => next()}
          >
            {transcript && score >= 75
              ? index === sentences.length - 1
                ? "Đạt rồi · đang hoàn tất…"
                : "Đạt rồi · tự chuyển…"
              : index === sentences.length - 1
                ? messages.common.finish
                : messages.speaking.next}
          </button>
        </div>
      </section>
    </div>
  );
}
