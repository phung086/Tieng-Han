import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, Clock3, Headphones, Sparkles } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { DashboardLiveStats } from "@/components/dashboard-live-stats";
import { lessons, skills } from "@/data/demo";

export default function DashboardPage() {
  const current = lessons.find((lesson) => lesson.status === "current")!;

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div><span className="kicker">오늘의 학습 · HÔM NAY</span><h1>좋은 오후예요, Hưng 👋</h1><p>Hôm nay chỉ cần thêm một chút nữa là đủ. Tiếp tục đúng chỗ bạn đã dừng.</p></div>
        <DashboardLiveStats />
      </header>

      <section className="dashboard-grid">
        <article className="continue-card">
          <div className="continue-copy">
            <span className="pill pill-soft">Tiếp tục học</span>
            <div className="lesson-index">Bài {current.number} · 초급 1</div>
            <h2>{current.title}</h2>
            <p>{current.vi} · Từ vựng, ngữ pháp và hội thoại</p>
            <div className="continue-meta"><span><Clock3 size={16} /> khoảng 18 phút</span><span><BookOpen size={16} /> 4 / 7 phần</span></div>
            <Link className="primary-button" href="/learn/3">Học tiếp <ArrowRight size={18} /></Link>
          </div>
          <div className="continue-visual">
            <div className="float-word word-one">학교</div><div className="float-word word-two">어디</div><div className="float-word word-three">갑니다</div>
            <ProgressRing value={current.progress} size={132} label="hoàn thành" />
          </div>
        </article>

        <article className="today-card">
          <div className="card-heading"><div><span className="eyebrow">Ôn hôm nay</span><h3>12 mục đang chờ bạn</h3></div><span className="review-count">12</span></div>
          <div className="review-breakdown"><div><span className="dot violet" /><span>8 từ vựng</span><strong>어휘</strong></div><div><span className="dot blue" /><span>2 ngữ pháp</span><strong>문법</strong></div><div><span className="dot mint" /><span>2 câu nghe</span><strong>듣기</strong></div></div>
          <Link className="secondary-button wide" href="/review">Ôn nhanh 8 phút <ChevronRight size={18} /></Link>
        </article>
      </section>

      <section className="section-block">
        <div className="section-title-row"><div><span className="eyebrow">Kỹ năng của bạn</span><h2>Học đều, nhưng tập trung đúng chỗ yếu</h2></div><Link href="/stats">Xem tiến độ <ArrowRight size={16} /></Link></div>
        <div className="skill-grid">
          {skills.map((skill) => (
            <article className={"skill-card tone-" + skill.tone} key={skill.name}>
              <div className="skill-top"><div><span className="skill-korean">{skill.korean}</span><h3>{skill.name}</h3></div><strong>{skill.score}%</strong></div>
              <div className="mini-progress"><span style={{ width: skill.score + "%" }} /></div><p>{skill.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="path-preview">
          <div className="card-heading"><div><span className="eyebrow">Lộ trình giáo trình</span><h3>Tiếng Hàn Sơ cấp 1</h3></div><span className="course-progress">32%</span></div>
          <div className="path-list">
            {lessons.slice(1, 5).map((lesson) => (
              <div className={"path-row " + lesson.status} key={lesson.number}><div className="path-node">{lesson.status === "done" ? "✓" : lesson.number}</div><div><strong>{lesson.title}</strong><span>{lesson.vi}</span></div>{lesson.status === "current" ? <span className="current-tag">Đang học</span> : null}</div>
            ))}
          </div>
          <Link className="text-button" href="/learn">Mở toàn bộ giáo trình <ArrowRight size={16} /></Link>
        </article>

        <article className="daily-mission">
          <div className="mission-icon"><Headphones size={28} /></div><span className="eyebrow">Nhiệm vụ nhỏ</span><h3>Nghe 5 câu trước khi kết thúc hôm nay</h3><p>Chỉ mất khoảng 4 phút. Nội dung lấy đúng từ Bài 3 bạn đang học.</p>
          <div className="mission-progress"><span /></div><div className="mission-footer"><span>2 / 5 câu</span><Link href="/listening"><Sparkles size={16} /> Luyện ngay</Link></div>
        </article>
      </section>
    </div>
  );
}
