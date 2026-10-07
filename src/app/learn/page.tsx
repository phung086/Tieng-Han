"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  LockKeyhole,
  Play,
  Sparkles,
  Star,
  Trophy,
  LibraryBig,
  Layers3,
  Search,
  X,
} from "lucide-react";
import { EmptyCourseState } from "@/components/empty-course-state";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";

export default function LearnPage() {
  const { state } = useLearning();
  const { course, courses, selectCourse } = useContent();
  const [courseQuery, setCourseQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const courseLevels = useMemo(
    () =>
      Array.from(
        new Set(
          courses
            .map((item) => item.level.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [courses],
  );

  const visibleCourses = useMemo(() => {
    const normalizedQuery = courseQuery.trim().toLocaleLowerCase("vi");
    return courses.filter((item) => {
      if (levelFilter !== "all" && item.level !== levelFilter) {
        return false;
      }

      if (!normalizedQuery) return true;

      return [
        item.title,
        item.level,
        item.source?.fileName ?? "",
      ].some((value) =>
        value.toLocaleLowerCase("vi").includes(normalizedQuery),
      );
    });
  }, [courseQuery, courses, levelFilter]);

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
      <section className="course-library-v2">
        <div className="section-head-v2">
          <div>
            <span className="experience-kicker">COURSE LIBRARY</span>
            <h2>Giáo trình của bạn</h2>
          </div>
          <span className="library-count-v2">
            <LibraryBig size={15} />
            {courses.length} giáo trình
          </span>
        </div>

        <div className="course-library-toolbar-v3">
          <label className="course-library-search-v3">
            <Search size={16} />
            <input
              aria-label="Tìm giáo trình"
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="Tìm theo tên giáo trình hoặc file nguồn…"
              type="search"
              value={courseQuery}
            />
            {courseQuery ? (
              <button
                aria-label="Xóa tìm kiếm"
                onClick={() => setCourseQuery("")}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </label>

          <select
            aria-label="Lọc theo cấp độ"
            className="course-library-filter-v3"
            onChange={(event) => setLevelFilter(event.target.value)}
            value={levelFilter}
          >
            <option value="all">Tất cả cấp độ</option>
            {courseLevels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <span className="course-library-result-v3">
            {visibleCourses.length}/{courses.length} giáo trình
          </span>
        </div>

        <div className="course-library-grid-v2">
          {visibleCourses.map((item) => {
            const active = item.id === course.id;
            return (
              <button
                className={
                  active
                    ? "course-library-card-v2 active"
                    : "course-library-card-v2"
                }
                key={item.id}
                type="button"
                aria-pressed={active}
                title={item.title}
                onClick={() => selectCourse(item.id)}
              >
                <div
                  className={
                    "course-library-cover-v2" +
                    (item.source?.coverImageDataUrl ? " actual-cover" : "")
                  }
                >
                  {item.source?.coverImageDataUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.source.coverImageDataUrl}
                      alt={item.title}
                    />
                  ) : (
                    <Layers3 size={28} />
                  )}
                </div>
                <div className="course-library-copy-v2">
                  <span>{item.level || "General"}</span>
                  <strong title={item.title}>{item.title}</strong>
                  <small>
                    {item.lessons.length} bài
                    {item.source?.pageCount
                      ? " · " + item.source.pageCount + " trang"
                      : ""}
                  </small>
                  <small>{item.source?.fileName ?? "Haneul Course"}</small>
                </div>
                <div className="course-library-state-v2">
                  {active ? "ĐANG HỌC" : "CHỌN"}
                </div>
              </button>
            );
          })}
        </div>

        {!visibleCourses.length ? (
          <div className="course-library-empty-v3">
            Không có giáo trình khớp bộ lọc hiện tại.
          </div>
        ) : null}
      </section>

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
        <section className="journey-zone-v2 course-switch-enter-v3" key={"zone-" + course.id + "-" + zoneIndex}>
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
