import { CalendarDays, Clock3, Flame, TrendingUp } from "lucide-react";
import { skills, weekly } from "@/data/demo";

export default function StatsPage() {
  const max = Math.max(...weekly.map((item) => item.minutes));

  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">TIẾN ĐỘ · 학습 기록</span>
          <h1>Nhìn tiến bộ, không nhìn áp lực</h1>
          <p>Thống kê chỉ để giúp bạn biết nên học gì tiếp theo.</p>
        </div>
      </header>

      <section className="stats-strip">
        <article><Flame size={21} /><span>Chuỗi hiện tại</span><strong>7 ngày</strong></article>
        <article><Clock3 size={21} /><span>Tuần này</span><strong>170 phút</strong></article>
        <article><CalendarDays size={21} /><span>Bài đã học</span><strong>2 / 6</strong></article>
        <article><TrendingUp size={21} /><span>Độ chính xác</span><strong>78%</strong></article>
      </section>

      <section className="stats-grid">
        <article className="chart-card">
          <div className="card-heading"><div><span className="eyebrow">7 ngày gần nhất</span><h3>Thời gian học</h3></div><strong>2h 50m</strong></div>
          <div className="bar-chart">
            {weekly.map((item) => (
              <div className="bar-column" key={item.day}>
                <div className="bar-value" style={{ height: `${Math.max(12, (item.minutes / max) * 100)}%` }}><span>{item.minutes}m</span></div>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="skill-detail-card">
          <div className="card-heading"><div><span className="eyebrow">Theo kỹ năng</span><h3>Mức độ hiện tại</h3></div></div>
          <div className="skill-detail-list">
            {skills.map((skill) => (
              <div className="skill-detail-row" key={skill.name}>
                <div><strong>{skill.name}</strong><span>{skill.korean}</span></div>
                <div className="detail-track"><span style={{ width: `${skill.score}%` }} /></div>
                <strong>{skill.score}%</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
