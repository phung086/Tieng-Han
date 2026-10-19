"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lightbulb, PenLine, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { useMessages } from "@/i18n/messages";
import { getNextLessonFlowStep } from "@/lib/lesson-flow";
import { writingChecks } from "@/lib/writing-rubric";
import { useWritingDraft } from "@/lib/learning-draft";

export function WritingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const { getLesson } = useContent();
  const messages = useMessages();
  const lesson = getLesson(lessonId);
  const content = lesson?.writing;
  const nextStep = getNextLessonFlowStep(lessonId, "writing");
  const [text, setText] = useWritingDraft(lessonId);
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const checks = writingChecks(text, lesson);

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
    if (submitted || !confirmed) return;
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
        <p>Kiểm tra sơ bộ theo đề và ví dụ của bài. Kết quả này không chấm độ đúng của ngữ pháp hoặc ý nghĩa toàn bài viết.</p>
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
          <div className="writing-word-bank" role="group" aria-label="Chèn từ tiếng Hàn không cần bàn phím">
            <p>Chạm để chèn từ gợi ý khi chưa có bàn phím tiếng Hàn:</p>
            {content.targetWords.map((word, index) => <button className="secondary-button" type="button" key={word + index} onClick={() => { setText(value => value + (value && !value.endsWith(" ") ? " " : "") + word); setSubmitted(false); }}>{word}</button>)}
          </div>
          <textarea
            maxLength={8000}
            aria-label="Bài viết tiếng Hàn của bạn"
            onChange={(event) => {
              setText(event.target.value);
              setSubmitted(false);
              setConfirmed(false);
            }}
            placeholder={messages.writing.placeholder}
            value={text}
          />
          <div className="writing-toolbar">
            <span>{text.length} {messages.writing.characters}</span>
            <span>Bản nháp được giữ trên máy này</span>
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
                  ? "Đạt checklist sơ bộ; đã ghi nhận lượt tự luyện."
                  : messages.writing.failed}
              </strong>
              <p>
                {checks
                  .filter((item) => !item.passed)
                  .map((item) => item.label)
                  .join(" · ") || "Đối chiếu thêm với đề, gợi ý và ví dụ trong giáo trình."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="writing-actions">
          <label className="writing-self-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi đã đối chiếu bài viết với đề và gợi ý giáo trình.</label>
          <button
            className="secondary-button"
            onClick={() => {
              setText("");
              setSubmitted(false);
              setConfirmed(false);
            }}
          >
            <RotateCcw size={16} /> {messages.writing.rewrite}
          </button>
          <button
            className="primary-button writing-submit"
            disabled={text.trim().length < 8 || !confirmed || submitted}
            onClick={evaluate}
          >
            {submitted ? "Đã kiểm tra" : "Kiểm tra bài viết"}
          </button>
        </div>

        <p>Checklist là gợi ý tự kiểm tra, không thay cho đánh giá ngữ pháp của giáo viên. Bạn có thể học tiếp bất cứ lúc nào.</p>
          <div className="writing-next-v4">
            <Link className="primary-button" href={nextStep.href}>
              Tiếp: {nextStep.label}
            </Link>
            <Link
              className="text-button writing-back"
              href={"/learn/" + lessonId}
            >
              {messages.writing.back}
            </Link>
          </div>
      </section>
    </div>
  );
}
