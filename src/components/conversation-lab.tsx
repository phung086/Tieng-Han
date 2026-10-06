"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageCircle,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

export function ConversationLab({ lessonId = 1 }: { lessonId?: number }) {
  const { getLesson, course } = useContent();
  const { recordAnswer } = useLearning();
  const lesson = getLesson(lessonId);
  const dialogues = lesson?.dialogues ?? [];

  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(true);
  const [role, setRole] = useState("");
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const dialogue = dialogues[dialogueIndex];
  const speakers = useMemo(() => {
    if (!dialogue) return [];
    return Array.from(
      new Set(
        dialogue.lines
          .map((line) => line.speaker)
          .filter((speaker): speaker is string => Boolean(speaker)),
      ),
    );
  }, [dialogue]);

  if (!lesson || !dialogues.length || !dialogue) {
    return <EmptySkillState lessonId={lessonId} skill="Hội thoại" />;
  }

  function speak(text: string, rate = 0.8) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function playDialogue() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    for (const line of dialogue.lines) {
      speak(line.targetText ?? line.ko, 0.78);
    }
  }

  function markPracticed() {
    if (completedIds.includes(dialogue.id)) return;
    setCompletedIds((current) => [...current, dialogue.id]);
    recordAnswer("speaking", true, "dialogue:" + dialogue.id);
  }

  const practiced = completedIds.includes(dialogue.id);

  return (
    <div className="conversation-lab-v4">
      <header className="conversation-head-v4">
        <div>
          <span className="experience-kicker">CONVERSATION LAB · BÀI {lessonId}</span>
          <h1>Nói theo tình huống thật.</h1>
          <p>
            Nghe cả đoạn, chọn vai rồi đọc đúng lượt của mình. Nội dung bám nguyên hội thoại từ giáo trình.
          </p>
        </div>
        <Link className="secondary-button" href={"/learn/" + lessonId}>
          <ArrowLeft size={16} /> Về bài học
        </Link>
      </header>

      <section className="conversation-toolbar-v4">
        <div className="conversation-tabs-v4">
          {dialogues.map((item, index) => (
            <button
              className={index === dialogueIndex ? "active" : ""}
              key={item.id}
              onClick={() => {
                setDialogueIndex(index);
                setRole("");
              }}
              type="button"
            >
              {item.title || "Hội thoại " + (index + 1)}
            </button>
          ))}
        </div>

        <div className="conversation-actions-v4">
          <button className="secondary-button" onClick={playDialogue} type="button">
            <Play size={16} /> Nghe toàn bộ
          </button>
          <button
            className="secondary-button"
            onClick={() => setShowMeaning((value) => !value)}
            type="button"
          >
            {showMeaning ? <EyeOff size={16} /> : <Eye size={16} />}
            {showMeaning ? "Ẩn nghĩa" : "Hiện nghĩa"}
          </button>
        </div>
      </section>

      <section className="conversation-role-v4">
        <div>
          <span className="experience-kicker">ROLE PLAY</span>
          <h2>Chọn vai của bạn</h2>
          <p>
            Dòng của bạn sẽ được làm nổi bật; các dòng còn lại là lời đối thoại để nghe và phản xạ.
          </p>
        </div>
        <div className="conversation-role-options-v4">
          {speakers.length ? (
            speakers.map((speaker) => (
              <button
                className={role === speaker ? "active" : ""}
                key={speaker}
                onClick={() => setRole(speaker)}
                type="button"
              >
                {speaker}
              </button>
            ))
          ) : (
            <button
              className={role === "me" ? "active" : ""}
              onClick={() => setRole("me")}
              type="button"
            >
              Vai của tôi
            </button>
          )}
        </div>
      </section>

      <section className="conversation-stage-v4">
        <div className="conversation-title-v4">
          <MessageCircle size={21} />
          <div>
            <span>대화</span>
            <h2>{dialogue.title || lesson.title}</h2>
          </div>
        </div>

        <div className="conversation-lines-v4">
          {dialogue.lines.map((line, index) => {
            const text = line.targetText ?? line.ko;
            const meaning = line.learnerMeaning ?? line.vi;
            const myTurn =
              role &&
              ((line.speaker && line.speaker === role) ||
                (!line.speaker && role === "me" && index % 2 === 0));

            return (
              <article
                className={
                  "conversation-line-v4" + (myTurn ? " my-turn" : "")
                }
                key={dialogue.id + "-" + index}
              >
                <div className="conversation-speaker-v4">
                  {line.speaker || (index % 2 === 0 ? "A" : "B")}
                </div>
                <div>
                  {myTurn ? <span className="my-turn-badge-v4">Lượt của bạn</span> : null}
                  <strong className="korean-text">{text}</strong>
                  {showMeaning && meaning ? <p>{meaning}</p> : null}
                </div>
                <button
                  className="icon-button"
                  onClick={() => {
                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                    speak(text);
                  }}
                  type="button"
                  aria-label={"Nghe " + text}
                >
                  <Volume2 size={17} />
                </button>
              </article>
            );
          })}
        </div>

        <div className="conversation-footer-v4">
          <div>
            {practiced ? (
              <span className="conversation-done-v4">
                <CheckCircle2 size={17} /> Đã ghi nhận lượt luyện
              </span>
            ) : (
              <span>
                <Sparkles size={16} /> Đọc ít nhất một lần theo vai rồi đánh dấu hoàn thành.
              </span>
            )}
          </div>
          <button
            className="primary-button"
            disabled={practiced}
            onClick={markPracticed}
            type="button"
          >
            {practiced ? "Đã luyện" : "Đã luyện xong"}
          </button>
        </div>
      </section>

      {dialogues.length > 1 ? (
        <button
          className="text-button conversation-reset-v4"
          onClick={() => {
            setDialogueIndex(0);
            setRole("");
          }}
          type="button"
        >
          <RotateCcw size={15} /> Quay lại hội thoại đầu
        </button>
      ) : null}
    </div>
  );
}
