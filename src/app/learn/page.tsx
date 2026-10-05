"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, Check, LockKeyhole, Play } from "lucide-react";
import { course } from "@/data/content";
import { useLearning, type SkillKey } from "@/lib/learning-state";

const chips: { key: SkillKey; label: string }[] = [
  { key: "vocabulary", label: "Từ vựng" },
  { key: "grammar", label: "Ngữ pháp" },
  { key: "listening", label: "Nghe" },
  { key: "speaking", label: "Nói" },
  { key: "reading", label: "Đọc" },
  { key: "writing", label: "Viết" },
];

export default function LearnPage() {
  const { state } = useLearning();
  const courseProgress = Math.round(
    course.lessons.reduce((sum, lesson) => sum + (state.lessonProgress[String(lesson.id)] ?? 0), 0) /
      Math.max(1, course.lessons.length),
  );
  const completed = course.lessons.filter((lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) >= 100).length;

  return (
    <div className="page">
      <header className="page-header compact">
        <div><span className="kicker">GIÁO TRÌNH · {course.level}</span><h1>{course.title}</h1><p>Mỗi bài đi theo cùng một workflow; khi nhập sách thật, lộ trình tự mở khóa theo tiến độ học của bạn.</p></div>
      </header>

      <section className="course-hero">
        <div className="book-cover"><span>한국어</span><strong>{course.level}</strong><small>Korean Beginner</small></div>
        <div className="course-copy">
          <span className="pill pill-soft">Giáo trình đang học</span><h2>{course.lessons.length} bài · {courseProgress}% hoàn thành</h2>
          <p>{completed} bài đã hoàn thành. Tiến độ này được tính từ 6 kỹ năng của từng bài.</p>
          <div className="course-progress-track"><span style={{ width: courseProgress + "%" }} /></div>
          <div className="course-meta"><span>{completed} bài hoàn thành</span><span>{course.lessons.length - completed} bài còn lại</span><span>Local progress</span></div>
        </div>
      </section>

      <section className="lesson-path">
        <div className="lesson-rail" />
        {course.lessons.map((lesson, index) => {
          const progress = state.lessonProgress[String(lesson.id)] ?? 0;
          const previousDone = index === 0 || (state.lessonProgress[String(course.lessons[index - 1].id)] ?? 0) >= 100;
          const done = progress >= 100;
          const unlocked = done || previousDone;
          const current = unlocked && !done;
          const status = done ? "done" : current ? "current" : "locked";

          return (
            <article className={"lesson-card " + status} key={lesson.id}>
              <div className="lesson-node">{done ? <Check size={22} /> : !unlocked ? <LockKeyhole size={19} /> : lesson.id}</div>
              <div className="lesson-card-body">
                <div className="lesson-card-title">
                  <div><span>Bài {lesson.id}</span><h3>{lesson.title}</h3><p>{lesson.vi}</p></div>
                  {current ? <span className="pill">Đang học · {progress}%</span> : null}
                  {done ? <span className="complete-label">Đã xong</span> : null}
                </div>

                <div className="lesson-chips">
                  {chips.map((chip) => {
                    const finished = state.completedActivities.includes("lesson:" + lesson.id + ":" + chip.key) || done;
                    return <span className={finished ? "chip done" : "chip"} key={chip.key}>{chip.label}</span>;
                  })}
                </div>

                {unlocked ? (
                  <Link className={current ? "primary-button small" : "secondary-button small"} href={"/learn/" + lesson.id}>
                    {done ? <BookMarked size={17} /> : <Play size={17} />}
                    {done ? "Ôn lại bài" : progress > 0 ? "Tiếp tục bài" : "Bắt đầu bài"}
                    <ArrowRight size={16} />
                  </Link>
                ) : <span className="locked-note">Hoàn thành bài trước để mở khóa</span>}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
