"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Grid3X3,
  Layers3,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";

type VocabMode = "cards" | "match";

export function VocabularyLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson, course } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const deck = lesson?.vocabulary ?? [];

  const [mode, setMode] = useState<VocabMode>("cards");
  const [order, setOrder] = useState(deck.map((_, index) => index));
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const [finished, setFinished] = useState(false);

  const matchItems = deck.slice(0, Math.min(6, deck.length));
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedMeaning, setSelectedMeaning] = useState("");
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchAttempts, setMatchAttempts] = useState(0);
  const [matchMessage, setMatchMessage] = useState(
    "Chọn một từ tiếng Hàn và nghĩa tương ứng.",
  );
  const [matchFinished, setMatchFinished] = useState(false);

  if (!lesson || !deck.length) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.vocabulary}
      />
    );
  }

  const card = deck[order[position]];
  const progress = Math.round(((position + 1) / order.length) * 100);
  const matchProgress = Math.round(
    (matchedIds.length / Math.max(1, matchItems.length)) * 100,
  );
  const nextStep = getNextLessonFlowStep(lessonId, "vocabulary");

  function speak(text = card.ko) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function rate(correct: boolean) {
    recordAnswer("vocabulary", correct, card.id);
    if (correct) setKnown((value) => value + 1);

    if (position === order.length - 1) {
      const finalKnown = known + (correct ? 1 : 0);
      if (finalKnown / deck.length >= 0.7) {
        completeLessonSkill(lessonId, "vocabulary");
      }
      setFinished(true);
      return;
    }

    setPosition((value) => value + 1);
    setRevealed(false);
  }

  function restartCards() {
    setPosition(0);
    setRevealed(false);
    setKnown(0);
    setFinished(false);
  }

  function shuffle() {
    setOrder((current) => [...current].sort(() => Math.random() - 0.5));
    restartCards();
  }

  function resetMatch() {
    setSelectedTarget("");
    setSelectedMeaning("");
    setMatchedIds([]);
    setMatchAttempts(0);
    setMatchMessage("Chọn một từ tiếng Hàn và nghĩa tương ứng.");
    setMatchFinished(false);
  }

  function resolveMatch(targetId: string, meaningId: string) {
    setMatchAttempts((value) => value + 1);

    if (targetId === meaningId) {
      if (!matchedIds.includes(targetId)) {
        const nextMatched = [...matchedIds, targetId];
        setMatchedIds(nextMatched);
        recordAnswer("vocabulary", true, targetId);
        setMatchMessage("Đúng rồi! Ghép tiếp cặp tiếp theo.");

        if (nextMatched.length === matchItems.length) {
          completeLessonSkill(lessonId, "vocabulary");
          setMatchFinished(true);
        }
      }
    } else {
      recordAnswer("vocabulary", false);
      setMatchMessage("Chưa khớp. Thử một cặp khác nhé.");
    }

    setSelectedTarget("");
    setSelectedMeaning("");
  }

  function chooseTarget(id: string) {
    if (matchedIds.includes(id)) return;
    setSelectedTarget(id);
    if (selectedMeaning) resolveMatch(id, selectedMeaning);
  }

  function chooseMeaning(id: string) {
    if (matchedIds.includes(id)) return;
    setSelectedMeaning(id);
    if (selectedTarget) resolveMatch(selectedTarget, id);
  }

  if (finished && mode === "cards") {
    const passed = known / deck.length >= 0.7;

    return (
      <div className="skill-complete-card">
        <div className="complete-orb"><CheckCircle2 size={32} /></div>
        <span className="eyebrow">
          {passed ? messages.vocabulary.complete : "CẦN CỦNG CỐ THÊM"}
        </span>
        <h1>{known}/{deck.length} {messages.vocabulary.rememberedSuffix}</h1>
        <p>
          {passed
            ? "Bạn đã đủ chắc để đi tiếp. Những từ quên vẫn sẽ quay lại trong hàng đợi ôn."
            : "Hãy thử lại hoặc dùng Ghép nhanh. Mục tiêu của chặng này là nhớ chủ động ít nhất 70% số từ."}
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={restartCards}>
            <RotateCcw size={16} /> {messages.vocabulary.reviewAgain}
          </button>
          <button className="secondary-button" onClick={() => setMode("match")}>
            <Grid3X3 size={16} /> Chơi Ghép nhanh
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

  if (matchFinished && mode === "match") {
    const accuracy = Math.round(
      (matchItems.length / Math.max(matchItems.length, matchAttempts)) * 100,
    );

    return (
      <div className="skill-complete-card vocab-match-complete-v4">
        <div className="complete-orb"><Sparkles size={32} /></div>
        <span className="eyebrow">GHÉP NHANH HOÀN TẤT</span>
        <h1>{matchItems.length} cặp đã ghép</h1>
        <p>
          Độ chính xác {accuracy}% · {matchAttempts} lượt chọn. Ghép từ và nghĩa giúp củng cố khả năng nhận diện nhanh.
        </p>
        <div className="complete-actions">
          <button className="secondary-button" onClick={resetMatch}>
            <RotateCcw size={16} /> Chơi lại
          </button>
          <button className="secondary-button" onClick={() => setMode("cards")}>
            <Layers3 size={16} /> Flashcard
          </button>
          <Link className="primary-button" href={nextStep.href}>
            Tiếp: {nextStep.label}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lab-page vocab-lab-v4">
      <header className="lab-header">
        <div>
          <span className="eyebrow">
            어휘 · {messages.common.lesson.toUpperCase()} {lessonId}
          </span>
          <h1>Từ vựng chủ động</h1>
          <p>
            {mode === "cards"
              ? "Nhớ trước khi lật: ép não tự gọi lại nghĩa thay vì chỉ đọc."
              : "Ghép từ với nghĩa trong một mini game ngắn để tăng tốc độ nhận diện."}
          </p>
        </div>

        <div className="vocab-mode-switch-v4" role="tablist" aria-label="Chế độ luyện từ vựng">
          <button
            className={mode === "cards" ? "active" : ""}
            onClick={() => setMode("cards")}
            type="button"
          >
            <Layers3 size={16} /> Flashcard
          </button>
          <button
            className={mode === "match" ? "active" : ""}
            onClick={() => setMode("match")}
            type="button"
          >
            <Grid3X3 size={16} /> Ghép nhanh
          </button>
        </div>
      </header>

      {mode === "cards" ? (
        <>
          <div className="lab-progress"><span style={{ width: progress + "%" }} /></div>

          <div className="lab-actions vocab-card-tools-v4">
            <span>{position + 1}/{order.length} từ</span>
            <button className="secondary-button" onClick={shuffle}>
              <Shuffle size={16} /> {messages.vocabulary.shuffle}
            </button>
          </div>

          <div
            className={"flashcard" + (revealed ? " revealed" : "")}
            onClick={() => setRevealed((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setRevealed((value) => !value);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span className="flash-index">{position + 1} / {order.length}</span>
            <button
              className="sound-button"
              onClick={(event) => {
                event.stopPropagation();
                speak();
              }}
              type="button"
              aria-label={messages.vocabulary.hearPronunciation}
            >
              <Volume2 size={20} />
            </button>

            <div className="flash-front">
              <strong>{card.ko}</strong>
              <span>{messages.vocabulary.tapMeaning}</span>
            </div>

            <div className="flash-back">
              <strong>{card.vi}</strong>
              <p className="korean-text">{card.example}</p>
              <span>{messages.vocabulary.tapBack}</span>
            </div>
          </div>

          <div className="memory-actions">
            <button
              disabled={!revealed}
              className="memory-button learning"
              onClick={() => rate(false)}
            >
              <span>↻</span>
              <strong>{messages.vocabulary.forgot}</strong>
              <small>{messages.vocabulary.forgotNote}</small>
            </button>

            <button
              disabled={!revealed}
              className="memory-button known"
              onClick={() => rate(true)}
            >
              <span>✓</span>
              <strong>{messages.vocabulary.remembered}</strong>
              <small>{messages.vocabulary.rememberedNote}</small>
            </button>
          </div>

          <div className="lab-meta">
            <span>{known} {messages.vocabulary.rememberedSession}</span>
            <span>{order.length - position} {messages.vocabulary.remaining}</span>
          </div>
        </>
      ) : (
        <section className="vocab-match-v4">
          <div className="vocab-match-top-v4">
            <div>
              <span className="experience-kicker">MATCH SPRINT</span>
              <h2>{matchedIds.length}/{matchItems.length} cặp</h2>
            </div>
            <div className="vocab-match-progress-v4">
              <i style={{ width: matchProgress + "%" }} />
            </div>
            <button className="icon-button" onClick={resetMatch} aria-label="Chơi lại">
              <RotateCcw size={17} />
            </button>
          </div>

          <p className="vocab-match-message-v4">{matchMessage}</p>

          <div className="vocab-match-board-v4">
            <div className="vocab-match-column-v4">
              <span>한국어</span>
              {matchItems.map((item) => (
                <button
                  className={
                    (selectedTarget === item.id ? " selected" : "") +
                    (matchedIds.includes(item.id) ? " matched" : "")
                  }
                  disabled={matchedIds.includes(item.id)}
                  key={"ko-" + item.id}
                  onClick={() => chooseTarget(item.id)}
                  type="button"
                >
                  <strong className="korean-text">{item.ko}</strong>
                  <Volume2
                    size={15}
                    onClick={(event) => {
                      event.stopPropagation();
                      speak(item.ko);
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="vocab-match-column-v4">
              <span>TIẾNG VIỆT</span>
              {[...matchItems].reverse().map((item) => (
                <button
                  className={
                    (selectedMeaning === item.id ? " selected" : "") +
                    (matchedIds.includes(item.id) ? " matched" : "")
                  }
                  disabled={matchedIds.includes(item.id)}
                  key={"vi-" + item.id}
                  onClick={() => chooseMeaning(item.id)}
                  type="button"
                >
                  <strong>{item.vi}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
