"use client";

import Link from "next/link";
import {
  Check,
  LockKeyhole,
  Map,
  Play,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { HaneulMascot } from "@/components/haneul-mascot";
import { EmptyCourseState } from "@/components/empty-course-state";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";

export default function LearnPage() {
  const { state } = useLearning();
  const { course } = useContent();

  if (!course.lessons.length) {
    return (
      <div className="page">
        <EmptyCourseState />
      </div>
    );
  }

  const completed = course.lessons.filter(
    (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) >= 100,
  ).length;
  const courseProgress = Math.round(
    course.lessons.reduce(
      (sum, lesson) =>
        sum + (state.lessonProgress[String(lesson.id)] ?? 0),
      0,
    ) / Math.max(1, course.lessons.length),
  );

  const current =
    course.lessons.find(
      (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100,
    ) ?? course.lessons[course.lessons.length - 1];

  return (
    <div className="page">
      <header className="world-header">
        <div>
          <span className="game-kicker">LEARNING WORLD</span>
          <h1>Bản đồ hành trình</h1>
          <p>
            Mở từng chặng theo thứ tự, hoàn thành đủ kỹ năng để tiến đến bài tiếp theo.
          </p>
        </div>

        <div className="world-stats">
          <div className="world-stat">
            <strong>{courseProgress}%</strong>
            <span>Tiến độ</span>
          </div>
          <div className="world-stat">
            <strong>{completed}/{course.lessons.length}</strong>
            <span>Hoàn thành</span>
          </div>
        </div>
      </header>

      <section className="course-world-hero">
        <div
          className={
            "book-cover" +
            (course.source?.coverImageDataUrl ? " actual-cover" : "")
          }
        >
          {course.source?.coverImageDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={course.source.coverImageDataUrl} alt={course.title} />
          ) : (
            <>
              <span>한국어</span>
              <strong>{course.level}</strong>
              <small>Haneul Course</small>
            </>
          )}
        </div>

        <div className="course-world-copy">
          <span className="game-kicker">{course.level}</span>
          <h2>{course.title}</h2>
          <p>
            {course.lessons.length} bài học · bài hiện tại: {current.id}
          </p>
          <div className="course-progress-track">
            <span style={{ width: courseProgress + "%" }} />
          </div>
        </div>

        <HaneulMascot size="sm" />
      </section>

      <section className="game-world-map" aria-label="Bản đồ bài học">
        {course.lessons.map((lesson, index) => {
          const progress = state.lessonProgress[String(lesson.id)] ?? 0;
          const previousDone =
            index === 0 ||
            (state.lessonProgress[String(course.lessons[index - 1].id)] ??
              0) >= 100;
          const done = progress >= 100;
          const unlocked = done || previousDone;
          const isCurrent = unlocked && !done;
          const status = done ? "done" : isCurrent ? "current" : "locked";

          return (
            <article className={"world-stop " + status} key={lesson.id}>
              <div className="world-node">
                {done ? (
                  <Check size={32} strokeWidth={3} />
                ) : unlocked ? (
                  <Play size={29} fill="currentColor" />
                ) : (
                  <LockKeyhole size={27} />
                )}
              </div>

              <div className="world-island">
                <span className="lesson-number">
                  {done ? (
                    <Trophy size={12} />
                  ) : isCurrent ? (
                    <Sparkles size={12} />
                  ) : (
                    <Map size={12} />
                  )}
                  Bài {String(lesson.id).padStart(2, "0")}
                </span>

                <h3>{lesson.title}</h3>
                <p>{lesson.vi}</p>

                <div className="world-progress">
                  <span style={{ width: progress + "%" }} />
                </div>

                {unlocked ? (
                  <Link
                    className="world-island-link"
                    href={"/learn/" + lesson.id}
                    aria-label={"Mở bài " + lesson.id + " " + lesson.title}
                  />
                ) : (
                  <span className="world-lock-note">
                    <LockKeyhole size={11} />
                    Hoàn thành bài trước để mở khóa
                  </span>
                )}
              </div>
            </article>
          );
        })}

        <div className="world-stop done">
          <div className="world-node">
            <Star size={34} fill="currentColor" />
          </div>
          <div className="world-island">
            <span className="lesson-number">
              <Trophy size={12} />
              Đích đến
            </span>
            <h3>Chinh phục {course.level}</h3>
            <p>Hoàn thành tất cả bài học để kết thúc hành trình.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
