"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, Volume2, X } from "lucide-react";

const options = [
  { id: "A", text: "ở / đến", ko: "에" },
  { id: "B", text: "tại / ở nơi diễn ra hành động", ko: "에서" },
  { id: "C", text: "và / với", ko: "하고" },
  { id: "D", text: "cũng", ko: "도" },
];

export function QuizDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = "A";
  const isCorrect = selected === correct;

  const feedback = useMemo(() => {
    if (!checked) return null;
    return isCorrect
      ? { title: "Chính xác! 잘했어요 ✨", body: "학교에 갑니다 dùng 에 vì trường học là đích đến của chuyển động." }
      : { title: "Gần đúng rồi", body: "Với động từ 가다 (đi), địa điểm là đích đến nên dùng 에: 학교에 갑니다." };
  }, [checked, isCorrect]);

  function reset() {
    setSelected(null);
    setChecked(false);
  }

  return (
    <div className="quiz-stage">
      <div className="quiz-topline">
        <button className="icon-button" onClick={reset} aria-label="Làm lại câu">
          <RotateCcw size={19} />
        </button>
        <div className="quiz-progress"><span style={{ width: "38%" }} /></div>
        <span className="quiz-step">3 / 8</span>
      </div>

      <div className="quiz-content">
        <span className="pill pill-soft">Ngữ pháp · Bài 3</span>
        <h1>Chọn trợ từ đúng cho câu sau</h1>
        <button className="sentence-card" type="button">
          <Volume2 size={21} />
          <span>저는 학교__ 갑니다.</span>
        </button>
        <p className="quiz-hint">“Tôi đi đến trường.”</p>

        <div className="answer-grid">
          {options.map((option) => {
            const selectedOption = selected === option.id;
            const stateClass = checked
              ? option.id === correct
                ? " correct"
                : selectedOption
                  ? " wrong"
                  : ""
              : selectedOption
                ? " selected"
                : "";

            return (
              <button
                className={`answer-option${stateClass}`}
                disabled={checked}
                key={option.id}
                onClick={() => setSelected(option.id)}
                type="button"
              >
                <span className="answer-key">{option.id}</span>
                <span className="answer-korean">{option.ko}</span>
                <span className="answer-meaning">{option.text}</span>
                {checked && option.id === correct ? <Check className="answer-state" size={20} /> : null}
                {checked && selectedOption && option.id !== correct ? <X className="answer-state" size={20} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className={checked ? `quiz-feedback visible ${isCorrect ? "success" : "error"}` : "quiz-feedback"}>
        {feedback ? (
          <div className="feedback-copy">
            <div className="feedback-icon">{isCorrect ? <Check size={22} /> : <X size={22} />}</div>
            <div><strong>{feedback.title}</strong><p>{feedback.body}</p></div>
          </div>
        ) : <span />}
        <button
          className="primary-button"
          disabled={!selected}
          onClick={() => checked ? reset() : setChecked(true)}
          type="button"
        >
          {checked ? "Câu tiếp theo" : "Kiểm tra"}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
