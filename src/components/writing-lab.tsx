"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lightbulb, PenLine, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";

export function WritingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const content = lesson?.writing;
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const checks = useMemo(() => {
    const targets = content?.targetWords ?? [];

    return [
      {
        label: messages.writing.threeSentences,
        passed:
          text
            .split(/[.!?\n]+/)
            .filter((item) => item.trim()).length >= 3,
      },
      {
        label: messages.writing.particles,
        passed: /에|에서/.test(text),
      },
      {
        label: messages.writing.sentenceEnding,
        passed: /니다|어요|아요/.test(text),
      },
      {
        label: messages.writing.targetWords,
        passed: targets.some((word) => text.includes(word)),
      },
    ];
  }, [content?.targetWords, messages, text]);

  if (!lesson || !content) {
    return (
      <EmptySkillState
        lessonId={lessonId}
        skill={messages.lesson.writing}
      />
    );
  }

  const score = Math.round(
    (checks.filter((item) => item.passed).length / checks.length) * 100,
  );

  function evaluate() {
    setSubmitted(true);
    recordAnswer("writing", score >= 75, "writing-" + lessonId);

    if (score >= 75) {
      completeLessonSkill(lessonId, "writing");
    }
  }

  return (
    <div className="skill-lab writing-lab">
      <header className="skill-lab-header">
        <span className="eyebrow">
          {messages.skills.writing.ko} · {messages.common.lesson.toUpperCase()} {lessonId}
        </span>
        <h1>{messages.writing.title}</h1>
        <p>{messages.writing.intro}</p>
      </header>

      <section className="writing-workspace">
        <div className="writing-prompt">
          <div className="prompt-icon"><PenLine size={23} /></div>
          <div>
            <span>{messages.writing.prompt} · {messages.common.lesson} {lessonId}</span>
            <h2>{content.prompt}</h2>
            <p>{content.hint}</p>
          </div>
        </div>

        <div className="writing-area">
          <textarea
            onChange={(event) => {
              setText(event.target.value);
              setSubmitted(false);
            }}
            placeholder={messages.writing.placeholder}
            value={text}
          />
          <div className="writing-toolbar">
            <span>{text.length} {messages.writing.characters}</span>
            <span>{messages.writing.draft}</span>
          </div>
        </div>

        <div className="writing-rubric">
          <div className="rubric-title">
            <Lightbulb size={18} />
            <strong>{messages.writing.checklist}</strong>
          </div>

          {checks.map((item) => (
            <div className={item.passed ? "passed" : ""} key={item.label}>
              <CheckCircle2 size={16} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {submitted ? (
          <div className="writing-feedback">
            <div
              className={
                score >= 75 ? "writing-score good" : "writing-score"
              }
            >
              <strong>{score}</strong>
              <span>/100</span>
            </div>
            <div>
              <strong>
                {score >= 75
                  ? messages.writing.passed
                  : messages.writing.failed}
              </strong>
              <p>
                {checks
                  .filter((item) => !item.passed)
                  .map((item) => item.label)
                  .join(" · ") || messages.writing.allPassed}
              </p>
            </div>
          </div>
        ) : null}

        <div className="writing-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setText("");
              setSubmitted(false);
            }}
          >
            <RotateCcw size={16} /> {messages.writing.rewrite}
          </button>
          <button
            className="primary-button writing-submit"
            disabled={text.trim().length < 8}
            onClick={evaluate}
          >
            {messages.writing.grade}
          </button>
        </div>

        {submitted && score >= 75 ? (
          <Link
            className="text-button writing-back"
            href={"/learn/" + lessonId}
          >
            {messages.writing.back}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
