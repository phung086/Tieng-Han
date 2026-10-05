"use client";

import { CalendarDays, Clock3, Flame, TrendingUp } from "lucide-react";
import { accuracy, lastNDays, useLearning, type SkillKey } from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";

export function StatsClient() {
  const { state } = useLearning();
  const messages = useMessages();
  const total = Object.values(state.skills).reduce((sum, item) => sum + item.total, 0);
  const correct = Object.values(state.skills).reduce((sum, item) => sum + item.correct, 0);
  const overall = total ? Math.round((correct / total) * 100) : 0;

  const days = lastNDays(7).map((key) => {
    const stat = state.dailyStats[key] ?? { attempts: 0, correct: 0, xp: 0 };
    const date = new Date(key + "T12:00:00");
    return {
      key,
      label: messages.stats.weekdays[date.getDay()],
      ...stat,
    };
  });

  const maxAttempts = Math.max(1, ...days.map((item) => item.attempts));

  const labels: Record<SkillKey, [string, string]> = {
    vocabulary: [messages.skills.vocabulary.vi, messages.skills.vocabulary.ko],
    grammar: [messages.skills.grammar.vi, messages.skills.grammar.ko],
    listening: [messages.skills.listening.vi, messages.skills.listening.ko],
    speaking: [messages.skills.speaking.vi, messages.skills.speaking.ko],
    reading: [messages.skills.reading.vi, messages.skills.reading.ko],
    writing: [messages.skills.writing.vi, messages.skills.writing.ko],
  };

  return (
    <>
      <section className="stats-strip">
        <article>
          <Flame size={21} />
          <span>{messages.stats.currentStreak}</span>
          <strong>{state.streak} {messages.stats.days}</strong>
        </article>
        <article>
          <Clock3 size={21} />
          <span>{messages.stats.todayXp}</span>
          <strong>{state.todayXp} XP</strong>
        </article>
        <article>
          <CalendarDays size={21} />
          <span>{messages.stats.totalXp}</span>
          <strong>{state.xp}</strong>
        </article>
        <article>
          <TrendingUp size={21} />
          <span>{messages.stats.accuracy}</span>
          <strong>{overall}%</strong>
        </article>
      </section>

      <section className="stats-grid">
        <article className="chart-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{messages.stats.last7Days}</span>
              <h3>{messages.stats.actualAttempts}</h3>
            </div>
            <strong>
              {days.reduce((sum, item) => sum + item.attempts, 0)} {messages.stats.attempts}
            </strong>
          </div>

          <div className="bar-chart">
            {days.map((item) => (
              <div className="bar-column" key={item.key}>
                <div
                  className="bar-value"
                  style={{
                    height:
                      Math.max(8, (item.attempts / maxAttempts) * 100) + "%",
                  }}
                >
                  <span>{item.attempts}</span>
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="skill-detail-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{messages.stats.bySkill}</span>
              <h3>{messages.stats.localData}</h3>
            </div>
          </div>

          <div className="skill-detail-list">
            {(Object.keys(labels) as SkillKey[]).map((key) => {
              const value = accuracy(state.skills[key]);
              return (
                <div className="skill-detail-row" key={key}>
                  <div>
                    <strong>{labels[key][0]}</strong>
                    <span>{labels[key][1]}</span>
                  </div>
                  <div className="detail-track">
                    <span style={{ width: value + "%" }} />
                  </div>
                  <strong>{value}%</strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </>
  );
}
