"use client";

import Link from "next/link";
import {
  Check,
  LockKeyhole,
  Play,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
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

  const zones = Array.from(
    { length: Math.ceil(course.lessons.length / 5) },
    (_, index) => course.lessons.slice(index * 5, index * 5 + 5),
  );

  return (
    <div className="page journey-page-v2">
      <section className="journey-hero-v2">
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

        <div className="journey-title-v2">
          <span className="experience-kicker">LEARNING WORLD</span>
          <h1>{course.title}</h1>
          <p>
            Đi từng chặng nhỏ, mở từng bài và giữ nhịp học đều. Bài hiện tại là Bài {current.id}.
          </p>
        </div>

        <div className="journey-stat-v2">
          <strong>{courseProgress}%</strong>
          <span>{completed}/{course.lessons.length} bài hoàn thành</span>
        </div>
      </section>

      {zones.map((lessons, zoneIndex) => (
        <section className="journey-zone-v2" key={"zone-" + zoneIndex}>
          <header className="zone-title-v2">
            <span className="zone-number-v2">{zoneIndex + 1}</span>
            <div>
              <span>CHẶNG {zoneIndex + 1}</span>
              <h2>
                {zoneIndex === 0
                  ? "Làm quen & tạo phản xạ"
                  : zoneIndex === 1
                    ? "Dùng tiếng Hàn trong đời sống"
                    : "Củng cố & chinh phục"}
              </h2>
            </div>
          </header>

          <div className="zone-path-v2">
            {lessons.map((lesson) => {
              const globalIndex = course.lessons.findIndex(
                (item) => item.id === lesson.id,
              );
              const progress =
                state.lessonProgress[String(lesson.id)] ?? 0;
              const previousDone =
                globalIndex === 0 ||
                (state.lessonProgress[
                  String(course.lessons[globalIndex - 1].id)
                ] ?? 0) >= 100;
              const done = progress >= 100;
              const unlocked = done || previousDone;
              const currentLesson = unlocked && !done;
              const status = done
                ? "done"
                : currentLesson
                  ? "current"
                  : "locked";

              return (
                <article
                  className={"journey-stop-v2 " + status}
                  key={lesson.id}
                >
                  <div className="journey-node-v2">
                    {done ? (
                      <Check size={29} strokeWidth={3} />
                    ) : unlocked ? (
                      <Play size={25} fill="currentColor" />
                    ) : (
                      <LockKeyhole size={24} />
                    )}
                  </div>

                  <div className="journey-card-v2">
                    <span>
                      {done
                        ? "ĐÃ HOÀN THÀNH"
                        : currentLesson
                          ? "ĐANG CHỜ BẠN"
                          : "CHƯA MỞ KHÓA"}
                    </span>
                    <h3>
                      Bài {String(lesson.id).padStart(2, "0")} · {lesson.title}
                    </h3>
                    <p>{lesson.vi}</p>
                    <div className="journey-mini-track-v2">
                      <i style={{ width: progress + "%" }} />
                    </div>

                    {unlocked ? (
                      <Link
                        href={"/learn/" + lesson.id}
                        aria-label={
                          "Mở bài " + lesson.id + " " + lesson.title
                        }
                      />
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="journey-zone-v2">
        <header className="zone-title-v2">
          <span className="zone-number-v2">
            <Star size={21} fill="currentColor" />
          </span>
          <div>
            <span>ĐÍCH ĐẾN</span>
            <h2>Chinh phục {course.level}</h2>
          </div>
        </header>

        <article className="mission-card-v2 course">
          <div className="mission-icon-v2">
            <Trophy size={25} />
          </div>
          <div>
            <strong>{completed}/{course.lessons.length} bài hoàn thành</strong>
            <p>
              Khi hoàn thành toàn bộ giáo trình, đây sẽ là cột mốc đầu tiên trong hành trình Haneul của bạn.
            </p>
          </div>
          <Link href="/stats" aria-label="Xem tiến độ">
            <Sparkles size={16} />
          </Link>
        </article>
      </section>
    </div>
  );
}
