"use client";

import { useState } from "react";
import { BookOpenText, Check, Eye, EyeOff, X } from "lucide-react";
import { getLesson } from "@/data/content";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

export function ReadingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const lesson = getLesson(lessonId);
  const content = lesson?.reading;
  const [showTranslation, setShowTranslation] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  if (!lesson || !content) return <EmptySkillState lessonId={lessonId} skill="Đọc" />;

  const correct = content.questions.filter((item, index) => answers[index] === item.answer).length;

  function submit() {
    setChecked(true);
    content.questions.forEach((item, index) => recordAnswer("reading", answers[index] === item.answer, item.id));
    completeLessonSkill(lessonId, "reading");
  }

  return (
    <div className="skill-lab reading-lab">
      <header className="skill-lab-header"><span className="eyebrow">읽기 · BÀI {lessonId}</span><h1>Đọc để hiểu ý, không dịch từng từ</h1><p>Ẩn nghĩa tiếng Việt mặc định để giữ sự tập trung vào ngữ cảnh tiếng Hàn.</p></header>
      <section className="reading-workspace">
        <article className="reading-passage"><div className="reading-passage-top"><div><BookOpenText size={20} /><span>Bài {lessonId} · {content.title}</span></div><button className="text-button" onClick={() => setShowTranslation((value) => !value)}>{showTranslation ? <EyeOff size={16} /> : <Eye size={16} />}{showTranslation ? "Ẩn nghĩa" : "Xem nghĩa"}</button></div><p className="korean-text">{content.text}</p>{showTranslation ? <div className="translation-box">{content.translation}</div> : null}</article>
        <article className="reading-questions">
          {content.questions.map((item, index) => <div className="reading-question" key={item.id}><span>Câu {index + 1}</span><h3 className="korean-text">{item.q}</h3><div className="reading-choice-row">{item.choices.map((choice) => { const selected = answers[index] === choice; const state = checked ? choice === item.answer ? " correct" : selected ? " wrong" : "" : selected ? " selected" : ""; return <button className={state} disabled={checked} key={choice} onClick={() => setAnswers((current) => ({ ...current, [index]: choice }))}>{choice}{checked && choice === item.answer ? <Check size={15} /> : null}{checked && selected && choice !== item.answer ? <X size={15} /> : null}</button>; })}</div></div>)}
          {checked ? <div className="reading-result"><strong>{correct}/{content.questions.length} câu đúng</strong><span>{correct === content.questions.length ? "Bạn đã nắm đúng ý chính." : "Xem lại đoạn văn rồi thử lại nếu cần."}</span></div> : null}
          <button className="primary-button" disabled={Object.keys(answers).length < content.questions.length} onClick={checked ? () => { setAnswers({}); setChecked(false); } : submit}>{checked ? "Làm lại" : "Kiểm tra đọc hiểu"}</button>
        </article>
      </section>
    </div>
  );
}
