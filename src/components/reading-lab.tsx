"use client";

import { useState } from "react";
import { BookOpenText, Check, Eye, EyeOff, X } from "lucide-react";
import { lessonContent } from "@/data/content";
import { useLearning } from "@/lib/learning-state";

const questions = [
  { q: "민수 씨는 아침에 어디에 갑니까?", choices: ["회사", "학교", "은행"], answer: "학교" },
  { q: "민수 씨는 오후에 어디에서 공부합니까?", choices: ["도서관", "집", "식당"], answer: "도서관" },
];

export function ReadingLab() {
  const { recordAnswer } = useLearning();
  const [showTranslation, setShowTranslation] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const content = lessonContent[3].reading;
  const correct = questions.filter((item, index) => answers[index] === item.answer).length;

  function submit() {
    setChecked(true);
    questions.forEach((item, index) => recordAnswer("reading", answers[index] === item.answer, `reading-3-${index}`));
  }

  return (
    <div className="skill-lab reading-lab">
      <header className="skill-lab-header"><span className="eyebrow">읽기 · READING</span><h1>Đọc để hiểu ý, không dịch từng từ</h1><p>Ẩn nghĩa tiếng Việt mặc định để giữ sự tập trung vào ngữ cảnh tiếng Hàn.</p></header>
      <section className="reading-workspace">
        <article className="reading-passage">
          <div className="reading-passage-top"><div><BookOpenText size={20} /><span>Bài 3 · 민수의 하루</span></div><button className="text-button" onClick={() => setShowTranslation((value) => !value)}>{showTranslation ? <EyeOff size={16} /> : <Eye size={16} />}{showTranslation ? "Ẩn nghĩa" : "Xem nghĩa"}</button></div>
          <p className="korean-text">{content.text}</p>
          {showTranslation ? <div className="translation-box">{content.translation}</div> : null}
        </article>

        <article className="reading-questions">
          {questions.map((item, index) => (
            <div className="reading-question" key={item.q}>
              <span>Câu {index + 1}</span><h3 className="korean-text">{item.q}</h3>
              <div className="reading-choice-row">{item.choices.map((choice) => {
                const selected = answers[index] === choice;
                const state = checked ? choice === item.answer ? " correct" : selected ? " wrong" : "" : selected ? " selected" : "";
                return <button className={state} disabled={checked} key={choice} onClick={() => setAnswers((current) => ({ ...current, [index]: choice }))}>{choice}{checked && choice === item.answer ? <Check size={15} /> : null}{checked && selected && choice !== item.answer ? <X size={15} /> : null}</button>;
              })}</div>
            </div>
          ))}
          {checked ? <div className="reading-result"><strong>{correct}/{questions.length} câu đúng</strong><span>{correct === questions.length ? "Bạn đã nắm đúng ý chính." : "Xem lại câu có 에 / 에서 rồi thử lại."}</span></div> : null}
          <button className="primary-button" disabled={Object.keys(answers).length < questions.length} onClick={checked ? () => { setAnswers({}); setChecked(false); } : submit}>{checked ? "Làm lại" : "Kiểm tra đọc hiểu"}</button>
        </article>
      </section>
    </div>
  );
}
