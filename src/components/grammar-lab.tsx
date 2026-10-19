"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";
import { buildLessonPracticeBank } from "@/lib/lesson-practice-bank";
import { GrammarExplanation } from "./grammar-explanation";
import { relatedGrammar } from "@/lib/related-grammar";
import { ItemIllustrations } from "./learning-illustration";

export function GrammarLab({ lessonId = 1 }: { lessonId?: number }) {
  const { getLesson, course, courses, hydrated } = useContent();
  const { state } = useLearning();
  const [active, setActive] = useState(0);
  const [all, setAll] = useState(false);
  const lesson = getLesson(lessonId);

  if (!hydrated) return <p role="status">Đang mở ngữ pháp của bài…</p>;

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
          <h1>Ngữ pháp · Bài {lessonId}</h1>
          <p>
            {lesson.grammar.length} mẫu câu · Hiểu cách dùng, nghe ví dụ, rồi tự thử.
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
          href={"/practice?lesson=" + lessonId + "&game=grammar#review-games"}
        >
          Chơi ghép mẫu câu · Xếp câu
        </Link>
        <Link
          className="secondary-button"
          href={"/practice/drills?lesson=" + lessonId}
        >
          Điền từ · Nghe chép · Luyện dịch
        </Link>
        <Link
          className="secondary-button"
          href={"/practice/workbook?lesson=" + lessonId}
        >
          Sổ luyện toàn bộ bài
        </Link>
      </section>

      <nav className="grammar-contents" aria-label="Các mẫu ngữ pháp trong bài">
        {lesson.grammar.map((item, index) => <button type="button" aria-pressed={!all && active === index} onClick={() => { setActive(index); setAll(false); }} key={item.id}>{item.pattern}</button>)}
        <button type="button" aria-pressed={all} onClick={() => setAll(value => !value)}>{all ? "Học từng mẫu" : "Xem toàn bộ ngữ pháp"}</button>
      </nav>
      <section className="grammar-concept-grid-v4">
        {lesson.grammar.map((item, index) => !all && index !== Math.min(active, lesson.grammar.length - 1) ? null : (
          <article className="grammar-concept-card-v4" key={item.id} id={"grammar-" + index}>
            <div className="grammar-concept-index-v4">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className="grammar-concept-copy-v4">
              <h2 className="korean-text">{item.pattern}</h2>
              <ItemIllustrations lesson={lesson} kind="grammar" itemId={item.id} />
              <GrammarExplanation key={item.id} item={item} onSpeak={speak} guided={!all} practiceHref={"/practice/quiz?lesson=" + lessonId + "&mode=guided&skill=grammar"} />


              {relatedGrammar(item, course.id, courses).map(related => <details className="grammar-related" key={related.courseId + related.lessonId + related.grammar.id}>
                <summary>Đọc thêm cùng mẫu · {related.courseTitle} · Bài {related.lessonId}</summary>

                <GrammarExplanation item={related.grammar} onSpeak={speak} />

              </details>)}
            </div>
          </article>
        ))}
      </section>

      <section className="grammar-practice-callout-v4">
        <div>
          <h2>Đã hiểu mẫu? Thử dùng trong câu.</h2>
          <p>
            Điểm số giúp chọn nội dung cần ôn lại. Bạn có thể chuyển bài bất cứ lúc nào; dùng mảnh câu thay cho bàn phím khi cần.
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
