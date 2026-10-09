"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  Clock3,
  Flame,
  Headphones,
  Layers3,
  Mic2,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { ActiveCourseChip } from "@/components/active-course-chip";
import { useContent } from "@/lib/content-store";
import { todayKey, useLearning } from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";
import { EmptyCourseState } from "@/components/empty-course-state";
import { summarizeLessonPractice } from "@/lib/lesson-practice-bank";

const skillModes = [
  { path: "/vocabulary", key: "vocabulary", icon: Layers3, tone: "blue" },
  { path: "/grammar", key: "grammar", icon: Brain, tone: "violet" },
  { path: "/listening", key: "listening", icon: Headphones, tone: "mint" },
  { path: "/speaking", key: "speaking", icon: Mic2, tone: "coral" },
  { path: "/reading", key: "reading", icon: BookOpenText, tone: "amber" },
  { path: "/writing", key: "writing", icon: PenLine, tone: "rose" },
] as const;

export default function PracticePage() {
  const { state } = useLearning();
  const { course } = useContent();
  const messages = useMessages();

  if (!course.lessons.length) {
    return (
      <div className="page">
        <EmptyCourseState compact />
      </div>
    );
  }

  const current =
    course.lessons.find(
      (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100,
    ) ?? course.lessons[course.lessons.length - 1];

  const today = todayKey();
  const dueCount = Object.values(state.mastery).filter(
    (item) => item.dueAt <= today,
  ).length;
  const currentProgress = state.lessonProgress[String(current.id)] ?? 0;
  const practice = summarizeLessonPractice(current, course.questions);

  const modes = [
    {
      key: "guided",
      icon: Sparkles,
      eyebrow: "GỢI Ý CHO BẠN",
      title: "Ôn đầy đủ theo sách",
      desc: "Toàn bộ " + practice.totalQuestions + " câu luyện đã nhập và sinh từ nội dung bài. Không giới hạn số câu.",
      meta: "Đầy đủ · theo từng bài",
      href: "/practice/quiz?lesson=" + current.id + "&mode=guided",
      tone: "violet",
    },
    {
      key: "quick",
      icon: Zap,
      eyebrow: "NHANH",
      title: "Quick 5",
      desc: "5 câu ngắn để giữ streak hoặc khởi động trước khi học sâu.",
      meta: "3–5 phút",
      href: "/practice/quiz?lesson=" + current.id + "&mode=quick",
      tone: "amber",
    },
    {
      key: "mastery",
      icon: Trophy,
      eyebrow: "THỬ THÁCH",
      title: "Mastery Check",
      desc: "Làm toàn bộ câu hỏi của bài để kiểm tra mức độ chắc kiến thức.",
      meta: "Mục tiêu ≥ 80%",
      href: "/practice/quiz?lesson=" + current.id + "&mode=mastery",
      tone: "mint",
    },
  ] as const;

  return (
    <div className="page practice-hub-v3">
      <header className="practice-head-v3">
        <div>
          <span className="experience-kicker">PRACTICE LAB</span>
          <h1>Luyện đúng thứ bạn cần, đúng lúc.</h1>
          <p>
            Chọn luyện toàn bài, xem sổ bài tập gốc, học một kỹ năng hoặc ôn lại điểm yếu.
          </p>
          <ActiveCourseChip compact />
        </div>

        <div className="practice-head-stats-v3">
          <span><Flame size={17} /> {state.streak} ngày</span>
          <span><Target size={17} /> {currentProgress}% bài hiện tại</span>
          <span><Clock3 size={17} /> {dueCount} mục đến hạn</span>
        </div>
      </header>

      <section className="practice-current-v3">
        <div className="practice-current-copy-v3">
          <span className="pill pill-soft">
            {course.level} · Bài {current.id}
          </span>
          <h2 className="korean-text">{current.title}</h2>
          <p>{current.vi} · {current.objective}</p>
          <div className="practice-current-track-v3">
            <i style={{ width: currentProgress + "%" }} />
          </div>
        </div>

        <Link
          className="primary-button"
          href={"/practice/quiz?lesson=" + current.id + "&mode=guided"}
        >
          Luyện toàn bài ({practice.totalQuestions} câu) <ArrowRight size={18} />
        </Link>
      </section>

      <section className="lesson-content-card">
        <div className="content-heading">
          <div>
            <span className="eyebrow">GIÁO TRÌNH GỐC · KHÔNG RÚT GỌN</span>
            <h2>Sổ luyện nguồn của Bài {current.id}</h2>
          </div>
          <Link className="primary-button" href={"/practice/workbook?lesson=" + current.id}>
            Xem từng mục trong sách <ArrowRight size={16} />
          </Link>
        </div>
        <p>
          Từ mới, ngữ pháp, câu ví dụ, hội thoại, nghe, đọc, viết và bài tập bổ sung;
          cả các mục chưa có đáp án để chấm tự động vẫn được giữ để luyện.
        </p>
      </section>

      <section className="practice-session-grid-v3">
        {modes.map(({ icon: Icon, ...mode }) => (
          <Link
            className={"practice-session-card-v3 tone-" + mode.tone}
            href={mode.href}
            key={mode.key}
          >
            <div className="practice-session-icon-v3">
              <Icon size={24} />
            </div>
            <span>{mode.eyebrow}</span>
            <h2>{mode.title}</h2>
            <p>{mode.desc}</p>
            <small>{mode.meta}</small>
            <ArrowRight className="practice-session-arrow-v3" size={18} />
          </Link>
        ))}
      </section>

      <section className="practice-section-v3">
        <div className="section-head-v2">
          <div>
            <span className="experience-kicker">FOCUS PRACTICE</span>
            <h2>Luyện riêng từng kỹ năng</h2>
          </div>
          <Link href="/review">
            Ôn điểm yếu <ArrowRight size={15} />
          </Link>
        </div>

        <div className="practice-mode-grid practice-mode-grid-v3">
          {skillModes.map(({ path, key, icon: Icon, tone }) => {
            const mode = messages.practice.modes[key];

            return (
              <Link
                className={"practice-mode tone-" + tone}
                href={path + "?lesson=" + current.id}
                key={path}
              >
                <div className="practice-mode-icon"><Icon size={23} /></div>
                <span>{mode.ko}</span>
                <h2>{mode.title}</h2>
                <p>{mode.desc}</p>
                <div className="mode-arrow"><ArrowRight size={17} /></div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="practice-review-callout-v3">
        <div className="practice-review-icon-v3">
          <Brain size={27} />
        </div>
        <div>
          <span className="experience-kicker">SMART REVIEW</span>
          <h2>
            {dueCount
              ? dueCount + " mục đang đến hạn ôn"
              : "Chưa có mục nào quá hạn"}
          </h2>
          <p>
            Haneul ưu tiên những mục bạn yếu hoặc sắp quên, thay vì bắt học lại cả bài.
          </p>
        </div>
        <Link className="secondary-button" href="/review">
          <ShieldCheck size={16} />
          Mở hàng đợi ôn tập
        </Link>
      </section>
    </div>
  );
}
