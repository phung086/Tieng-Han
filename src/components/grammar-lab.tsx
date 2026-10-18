"use client";

import Link from "next/link";
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

export function GrammarLab({ lessonId = 1 }: { lessonId?: number }) {
  const { getLesson, course, courses, hydrated } = useContent();
  const { state } = useLearning();
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
          <h1>Ngữ pháp Bài {lessonId} · Hiểu rồi dùng ngay.</h1>
          <p>
            {lesson.grammar.length} mẫu câu · Giải thích, lưu ý và ví dụ đã nhập được giữ đầy đủ, kèm nguồn để đối chiếu.
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
        {lesson.grammar.map((item, index) => <a href={"#grammar-" + index} key={item.id}>{item.pattern}</a>)}
      </nav>
      <section className="grammar-concept-grid-v4">
        {lesson.grammar.map((item, index) => (
          <article className="grammar-concept-card-v4" key={item.id} id={"grammar-" + index}>
            <div className="grammar-concept-index-v4">
              {String(index + 1).padStart(2, "0")}
            </div>

            <div className="grammar-concept-copy-v4">
              <h2 className="korean-text">{item.pattern}</h2>
              <GrammarExplanation item={item} onSpeak={speak} />

              {item.sourceRef ? (
                <small className="source-ref">{item.sourceRef}</small>
              ) : null}
              {relatedGrammar(item, course.id, courses).map(related => <details className="grammar-related" key={related.courseId + related.lessonId + related.grammar.id}>
                <summary>Đọc thêm cùng mẫu · {related.courseTitle} · Bài {related.lessonId}</summary>
                <p>Phần tham khảo từ giáo trình khác trong thư viện, giữ nguồn riêng; không thay thế nội dung của bài đang học.</p>
                <GrammarExplanation item={related.grammar} onSpeak={speak} />
                <small className="source-ref">{related.grammar.sourceRef}</small>
              </details>)}
            </div>
          </article>
        ))}
      </section>

      <section className="grammar-practice-callout-v4">
        <div>
          <h2>Đừng chỉ đọc hiểu — hãy tự chọn, điền và sắp xếp câu.</h2>
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
