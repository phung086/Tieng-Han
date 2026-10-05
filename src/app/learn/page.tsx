import Link from "next/link";
import { ArrowRight, BookMarked, Check, LockKeyhole, Play } from "lucide-react";
import { lessons } from "@/data/demo";

const chips = ["Từ vựng", "Ngữ pháp", "Nghe", "Nói", "Đọc", "Viết"];

export default function LearnPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">GIÁO TRÌNH · 초급 1</span>
          <h1>Tiếng Hàn Sơ cấp 1</h1>
          <p>Đi theo từng bài của sách. Mỗi bài gom toàn bộ từ vựng, ngữ pháp và bốn kỹ năng vào một luồng.</p>
        </div>
      </header>

      <section className="course-hero">
        <div className="book-cover">
          <span>한국어</span>
          <strong>초급 1</strong>
          <small>Korean Beginner</small>
        </div>
        <div className="course-copy">
          <span className="pill pill-soft">Giáo trình đang học</span>
          <h2>6 bài mẫu · 32% hoàn thành</h2>
          <p>Base UI đang dùng dữ liệu demo. Khi nhập sách thật, cấu trúc này sẽ map trực tiếp theo từng bài và từng mục trong sách.</p>
          <div className="course-progress-track"><span style={{ width: "32%" }} /></div>
          <div className="course-meta"><span>2 bài hoàn thành</span><span>1 bài đang học</span><span>3 bài phía trước</span></div>
        </div>
      </section>

      <section className="lesson-path">
        <div className="lesson-rail" />
        {lessons.map((lesson) => {
          const locked = lesson.status === "locked";
          return (
            <article className={`lesson-card ${lesson.status}`} key={lesson.number}>
              <div className="lesson-node">
                {lesson.status === "done" ? <Check size={22} /> : locked ? <LockKeyhole size={19} /> : lesson.number}
              </div>
              <div className="lesson-card-body">
                <div className="lesson-card-title">
                  <div>
                    <span>Bài {lesson.number}</span>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.vi}</p>
                  </div>
                  {lesson.status === "current" ? <span className="pill">Đang học · {lesson.progress}%</span> : null}
                  {lesson.status === "done" ? <span className="complete-label">Đã xong</span> : null}
                </div>

                <div className="lesson-chips">
                  {chips.map((chip, index) => (
                    <span className={lesson.status === "done" || (lesson.status === "current" && index < 4) ? "chip done" : "chip"} key={chip}>
                      {chip}
                    </span>
                  ))}
                </div>

                {!locked ? (
                  <Link className={lesson.status === "current" ? "primary-button small" : "secondary-button small"} href="/practice">
                    {lesson.status === "done" ? <BookMarked size={17} /> : <Play size={17} />}
                    {lesson.status === "done" ? "Ôn lại bài" : lesson.status === "current" ? "Tiếp tục bài" : "Bắt đầu bài"}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span className="locked-note">Hoàn thành bài trước để mở khóa</span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
