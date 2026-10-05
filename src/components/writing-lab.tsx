"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lightbulb, PenLine, RotateCcw } from "lucide-react";
import { getLesson } from "@/data/content";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

export function WritingLab({ lessonId = 3 }: { lessonId?: number }) {
  const { recordAnswer, completeLessonSkill } = useLearning();
  const lesson = getLesson(lessonId);
  const content = lesson?.writing;
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const checks = useMemo(() => {
    const targets = content?.targetWords ?? [];
    return [
      { label: "Có ít nhất 3 câu", passed: text.split(/[.!?\n]+/).filter((item) => item.trim()).length >= 3 },
      { label: "Có dùng trợ từ 에 / 에서", passed: /에|에서/.test(text) },
      { label: "Có động từ kết thúc câu", passed: /니다|어요|아요/.test(text) },
      { label: "Có từ vựng mục tiêu của bài", passed: targets.some((word) => text.includes(word)) },
    ];
  }, [content?.targetWords, text]);

  if (!lesson || !content) return <EmptySkillState lessonId={lessonId} skill="Viết" />;

  const score = Math.round((checks.filter((item) => item.passed).length / checks.length) * 100);

  function evaluate() {
    setSubmitted(true);
    recordAnswer("writing", score >= 75, "writing-" + lessonId);
    if (score >= 75) completeLessonSkill(lessonId, "writing");
  }

  return (
    <div className="skill-lab writing-lab">
      <header className="skill-lab-header"><span className="eyebrow">쓰기 · BÀI {lessonId}</span><h1>Viết ngắn nhưng dùng đúng điều vừa học</h1><p>Rubric local chỉ kiểm tra mục tiêu bài; sau này có thể thêm AI feedback mà không thay workflow.</p></header>
      <section className="writing-workspace">
        <div className="writing-prompt"><div className="prompt-icon"><PenLine size={23} /></div><div><span>Đề bài · Bài {lessonId}</span><h2>{content.prompt}</h2><p>{content.hint}</p></div></div>
        <div className="writing-area"><textarea onChange={(event) => { setText(event.target.value); setSubmitted(false); }} placeholder="Viết câu trả lời của bạn bằng tiếng Hàn…" value={text} /><div className="writing-toolbar"><span>{text.length} ký tự</span><span>Bản nháp local trong phiên</span></div></div>
        <div className="writing-rubric"><div className="rubric-title"><Lightbulb size={18} /><strong>Checklist trước khi chấm</strong></div>{checks.map((item) => <div className={item.passed ? "passed" : ""} key={item.label}><CheckCircle2 size={16} /><span>{item.label}</span></div>)}</div>
        {submitted ? <div className="writing-feedback"><div className={score >= 75 ? "writing-score good" : "writing-score"}><strong>{score}</strong><span>/100</span></div><div><strong>{score >= 75 ? "Bài viết đạt mục tiêu của bài." : "Chưa đạt ngưỡng hoàn thành 75%."}</strong><p>{checks.filter((item) => !item.passed).map((item) => item.label).join(" · ") || "Đủ số câu và có sử dụng cấu trúc mục tiêu."}</p></div></div> : null}
        <div className="writing-actions"><button className="secondary-button" onClick={() => { setText(""); setSubmitted(false); }}><RotateCcw size={16} /> Viết lại</button><button className="primary-button writing-submit" disabled={text.trim().length < 8} onClick={evaluate}>Chấm bài local</button></div>
        {submitted && score >= 75 ? <Link className="text-button writing-back" href={"/learn/" + lessonId}>Hoàn thành · quay lại bài học</Link> : null}
      </section>
    </div>
  );
}
