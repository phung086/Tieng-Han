"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mic, MicOff, Play, RotateCcw, Volume2 } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

const AUTO_ADVANCE_DELAY_MS = 1200;

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

function normalize(value: string) {
  return value.replace(/[\s.!?]/g, "");
}

function similarity(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;

  let hits = 0;
  for (const char of left) {
    if (right.includes(char)) hits += 1;
  }

  return Math.min(
    100,
    Math.round((hits / Math.max(left.length, right.length)) * 100),
  );
}

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
  const score = useMemo(
    () => similarity(transcript, target),
    [transcript, target],
  );

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

      if (result >= 75) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          next(nextScores);
        }, AUTO_ADVANCE_DELAY_MS);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;

    setListening(true);
    setTranscript("");
    recognition.start();
  }

  function next(effectiveScores = scores) {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (index === sentences.length - 1) {
      const availableScores = effectiveScores.filter(
        (item) => typeof item === "number",
      );
      const average = availableScores.length
        ? Math.round(
            availableScores.reduce((sum, item) => sum + item, 0) /
              availableScores.length,
          )
        : 0;

      if (unsupported || average >= 75) {
        completeLessonSkill(lessonId, "speaking");
      }
      setFinished(true);
      return;
    }

    setIndex((value) => value + 1);
    setTranscript("");
  }

  function restart() {
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
    const average = scores.length
      ? Math.round(
          scores.reduce((sum, item) => sum + item, 0) / scores.length,
        )
      : 0;
    const passed = unsupported || average >= 75;

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
              ? "Trình duyệt không hỗ trợ chấm giọng nói, nên Haneul ghi nhận lượt shadowing thủ công."
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
      <header className="skill-lab-header">
        <span className="eyebrow">
          {messages.skills.speaking.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
        </span>
        <h1>{messages.speaking.title}</h1>
        <p>{messages.speaking.intro}</p>
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
            className={
              "primary-button" +
              (transcript && score >= 75 ? " auto-advance-button-v3" : "")
            }
            disabled={!unsupported && (!transcript || score >= 75)}
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
