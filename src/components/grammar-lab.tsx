"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { buildLessonPracticeBank } from "@/lib/lesson-practice-bank";

export function GrammarLab({ lessonId = 1 }: { lessonId?: number }) {
  const { getLesson, course } = useContent();
  const { state } = useLearning();
  const lesson = getLesson(lessonId);

  if (!lesson || !lesson.grammar.length) {
    return <EmptySkillState lessonId={lessonId} skill="Ngữ pháp" />;
  }

  const completed = state.completedActivities.includes(
    "lesson:" + lessonId + ":grammar",
  );
  const questionCount = buildLessonPracticeBank(lesson, course.questions)
    .filter((item) => item.skill === "grammar").length;

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="grammar-lab-v4">
      <header className="grammar-lab-head-v4">
        <div>
          <span className="experience-kicker">GRAMMAR LAB · BÀI {lessonId}</span>
          <h1>Hiểu mẫu câu, rồi dùng ngay.</h1>
          <p>
            Đọc ngắn, nghe ví dụ và luyện đúng những điểm ngữ pháp xuất hiện trong giáo trình.
          </p>
        </div>

        <div className={completed ? "grammar-status-v4 done" : "grammar-status-v4"}>
          {completed ? <CheckCircle2 size={19} /> : <BookOpenCheck size={19} />}
          <span>{completed ? "Đã hoàn thành" : questionCount + " câu luyện"}</span>
        </div>
      </header>

      <section className="grammar-focus-v4">
        <div>
          <span className="pill pill-soft">{course.level} · {lesson.title}</span>
          <h2>{lesson.vi}</h2>
          <p>{lesson.objective}</p>
        </div>

        <Link
          className="primary-button"
          href={
            "/practice/quiz?lesson=" +
            lessonId +
            "&mode=guided&skill=grammar"
          }
        >
          <Sparkles size={17} />
          Luyện ngữ pháp
          <ArrowRight size={17} />
        </Link>
        <Link
          className="secondary-button"
          href={"/practice/workbook?lesson=" + lessonId}
        >
          Sổ luyện toàn bộ bài
        </Link>
      </section>

      <section className="grammar-concept-grid-v4">
        {lesson.grammar.map((item, index) => (
          <article className="grammar-concept-card-v4" key={item.id}>
            <div className="grammar-concept-index-v4">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className="grammar-concept-copy-v4">
              <span>문법</span>
              <h2 className="korean-text">{item.pattern}</h2>
              <strong>{item.meaning}</strong>
              <p>{item.explanation}</p>

              <div className="grammar-concept-examples-v4">
                {item.examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => speak(example)}
                    type="button"
                  >
                    <Volume2 size={15} />
                    <span className="korean-text">{example}</span>
                  </button>
                ))}
              </div>

              {item.sourceRef ? (
                <small className="source-ref">{item.sourceRef}</small>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="grammar-practice-callout-v4">
        <div>
          <span className="experience-kicker">CHECK YOURSELF</span>
          <h2>Đừng chỉ đọc hiểu — hãy tự chọn, điền và sắp xếp câu.</h2>
          <p>
            Hoàn thành tối thiểu 75% câu hỏi ngữ pháp để Haneul đánh dấu chặng này là đã nắm.
          </p>
        </div>
        <Link
          className="primary-button"
          href={
            "/practice/quiz?lesson=" +
            lessonId +
            "&mode=guided&skill=grammar"
          }
        >
          Bắt đầu {questionCount || ""} câu
          <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
