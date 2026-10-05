"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, Headphones, Layers3, Mic2, PenLine, Sparkles } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";

const modes = [
  { path: "/practice/quiz", title: "Luyện tổng hợp", ko: "종합 연습", desc: "Trộn từ vựng, ngữ pháp, đọc và viết theo bài hiện tại.", icon: Sparkles, tone: "violet" },
  { path: "/vocabulary", title: "Flashcard từ vựng", ko: "어휘", desc: "Lật thẻ, nghe phát âm và tự đánh giá độ nhớ.", icon: Layers3, tone: "blue" },
  { path: "/listening", title: "Luyện nghe", ko: "듣기", desc: "Nghe audio/TTS, chọn ý nghĩa và nghe lại chậm.", icon: Headphones, tone: "mint" },
  { path: "/speaking", title: "Luyện nói", ko: "말하기", desc: "Shadowing và nhận dạng giọng nói trong trình duyệt.", icon: Mic2, tone: "coral" },
  { path: "/reading", title: "Đọc hiểu", ko: "읽기", desc: "Đọc đoạn ngắn, ẩn nghĩa và trả lời câu hỏi.", icon: BookOpenText, tone: "amber" },
  { path: "/writing", title: "Luyện viết", ko: "쓰기", desc: "Viết theo đề và tự chấm bằng rubric local.", icon: PenLine, tone: "rose" },
];

export default function PracticePage() {
  const { state } = useLearning();
  const { course } = useContent();
  const current =
    course.lessons.find((lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100) ??
    course.lessons[course.lessons.length - 1];

  return (
    <div className="page">
      <header className="page-header compact">
        <div><span className="kicker">LUYỆN TẬP · 연습</span><h1>Chọn đúng thứ bạn muốn luyện</h1><p>Mặc định mọi mode bám theo Bài {current.id} đang học; bạn không cần chọn lại bài mỗi lần.</p></div>
      </header>

      <section className="practice-feature">
        <div>
          <span className="pill pill-soft">Đề xuất hôm nay</span>
          <h2>Phiên tổng hợp Bài {current.id}</h2>
          <p>{current.title} · {current.objective}</p>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + current.id}>Bắt đầu phiên học <ArrowRight size={18} /></Link>
        </div>
        <div className="practice-brain"><Brain size={48} /></div>
      </section>

      <section className="practice-mode-grid">
        {modes.map(({ path, title, ko, desc, icon: Icon, tone }) => (
          <Link className={"practice-mode tone-" + tone} href={path + "?lesson=" + current.id} key={path}>
            <div className="practice-mode-icon"><Icon size={23} /></div>
            <span>{ko}</span><h2>{title}</h2><p>{desc}</p><div className="mode-arrow"><ArrowRight size={17} /></div>
          </Link>
        ))}
      </section>
    </div>
  );
}
