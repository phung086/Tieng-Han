"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Lightbulb, PenLine } from "lucide-react";
import { useLearning } from "@/lib/learning-state";

const checks = [
  { label: "Có ít nhất 3 câu", test: (text: string) => text.split(/[.!?\n]+/).filter((item) => item.trim()).length >= 3 },
  { label: "Có dùng trợ từ 에 / 에서", test: (text: string) => /에|에서/.test(text) },
  { label: "Có động từ kết thúc câu", test: (text: string) => /니다|어요|아요/.test(text) },
  { label: "Có ít nhất một địa điểm", test: (text: string) => /학교|집|도서관|회사|은행|식당/.test(text) },
];

export function WritingLab() {
  const { recordAnswer } = useLearning();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const results = useMemo(() => checks.map((check) => ({ ...check, passed: check.test(text) })), [text]);
  const score = Math.round((results.filter((item) => item.passed).length / checks.length) * 100);

  function evaluate() { setSubmitted(true); recordAnswer("writing", score >= 75, "writing-lesson-3"); }

  return (
    <div className="skill-lab writing-lab">
      <header className="skill-lab-header"><span className="eyebrow">쓰기 · WRITING</span><h1>Viết ngắn nhưng dùng đúng điều vừa học</h1><p>Chấm local theo rubric rõ ràng; sau này có thể thay lớp đánh giá bằng AI mà giữ nguyên giao diện.</p></header>
      <section className="writing-workspace">
        <div className="writing-prompt"><div className="prompt-icon"><PenLine size={23} /></div><div><span>Đề bài · Bài 3</span><h2>Viết 3–5 câu về những nơi bạn thường đi trong ngày.</h2><p>Thử dùng <strong>에</strong> với động từ di chuyển và <strong>에서</strong> với hành động.</p></div></div>
        <div className="writing-area"><textarea onChange={(event) => { setText(event.target.value); setSubmitted(false); }} placeholder={"Ví dụ:\n아침에 학교에 갑니다.\n오후에 도서관에서 공부합니다.\n저녁에 집에 갑니다."} value={text} /><div className="writing-toolbar"><span>{text.length} ký tự</span><span>Local draft</span></div></div>
        <div className="writing-rubric"><div className="rubric-title"><Lightbulb size={18} /><strong>Checklist trước khi chấm</strong></div>{results.map((item) => <div className={item.passed ? "passed" : ""} key={item.label}><CheckCircle2 size={16} /><span>{item.label}</span></div>)}</div>
        {submitted ? <div className="writing-feedback"><div className={score >= 75 ? "writing-score good" : "writing-score"}><strong>{score}</strong><span>/100</span></div><div><strong>{score >= 75 ? "Bài viết đạt mục tiêu của bài." : "Cần bổ sung một chút trước khi qua bài."}</strong><p>{results.filter((item) => !item.passed).map((item) => item.label).join(" · ") || "Đủ số câu, có địa điểm và dùng cấu trúc mục tiêu."}</p></div></div> : null}
        <button className="primary-button writing-submit" disabled={text.trim().length < 8} onClick={evaluate}>Chấm bài local</button>
      </section>
    </div>
  );
}
