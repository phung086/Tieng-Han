"use client";

import { CalendarDays, Clock3, Flame, TrendingUp } from "lucide-react";
import { accuracy, lastNDays, useLearning, type SkillKey } from "@/lib/learning-state";

const labels: Record<SkillKey, [string, string]> = {
  vocabulary: ["Từ vựng", "어휘"],
  grammar: ["Ngữ pháp", "문법"],
  listening: ["Nghe", "듣기"],
  speaking: ["Nói", "말하기"],
  reading: ["Đọc", "읽기"],
  writing: ["Viết", "쓰기"],
};

const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function StatsClient() {
  const { state } = useLearning();
  const total = Object.values(state.skills).reduce((sum, item) => sum + item.total, 0);
  const correct = Object.values(state.skills).reduce((sum, item) => sum + item.correct, 0);
  const overall = total ? Math.round((correct / total) * 100) : 0;
  const days = lastNDays(7).map((key) => {
    const stat = state.dailyStats[key] ?? { attempts: 0, correct: 0, xp: 0 };
    const date = new Date(key + "T12:00:00");
    return { key, label: weekdays[date.getDay()], ...stat };
  });
  const maxAttempts = Math.max(1, ...days.map((item) => item.attempts));

  return (
    <>
      <section className="stats-strip">
        <article><Flame size={21} /><span>Chuỗi hiện tại</span><strong>{state.streak} ngày</strong></article>
        <article><Clock3 size={21} /><span>XP hôm nay</span><strong>{state.todayXp} XP</strong></article>
        <article><CalendarDays size={21} /><span>Tổng XP</span><strong>{state.xp}</strong></article>
        <article><TrendingUp size={21} /><span>Độ chính xác</span><strong>{overall}%</strong></article>
      </section>

      <section className="stats-grid">
        <article className="chart-card">
          <div className="card-heading"><div><span className="eyebrow">7 ngày gần nhất</span><h3>Lượt luyện thực tế</h3></div><strong>{days.reduce((sum, item) => sum + item.attempts, 0)} lượt</strong></div>
          <div className="bar-chart">
            {days.map((item) => (
              <div className="bar-column" key={item.key}>
                <div className="bar-value" style={{ height: Math.max(8, (item.attempts / maxAttempts) * 100) + "%" }}><span>{item.attempts}</span></div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="skill-detail-card">
          <div className="card-heading"><div><span className="eyebrow">Theo kỹ năng</span><h3>Dữ liệu local của bạn</h3></div></div>
          <div className="skill-detail-list">
            {(Object.keys(labels) as SkillKey[]).map((key) => {
              const value = accuracy(state.skills[key]);
              return <div className="skill-detail-row" key={key}><div><strong>{labels[key][0]}</strong><span>{labels[key][1]}</span></div><div className="detail-track"><span style={{ width: value + "%" }} /></div><strong>{value}%</strong></div>;
            })}
          </div>
        </article>
      </section>
    </>
  );
}
