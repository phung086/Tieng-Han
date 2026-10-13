"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  Flame,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { buildLearningAnalytics } from "@/lib/learning-analytics";
import {
  accuracy,
  lastNDays,
  todayKey,
  useLearning,
  type SkillKey,
} from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";

function previousNDays(count: number) {
  const recent = lastNDays(count);
  const first = new Date(recent[0] + "T12:00:00");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() - count + index);
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000,
    );
    return local.toISOString().slice(0, 10);
  });
}

export function StatsClient() {
  const { state } = useLearning();
  const messages = useMessages();
  const total = Object.values(state.skills).reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const correct = Object.values(state.skills).reduce(
    (sum, item) => sum + item.correct,
    0,
  );
  const overall = total ? Math.round((correct / total) * 100) : 0;

  const recentKeys = lastNDays(7);
  const analytics = buildLearningAnalytics(
    state,
    todayKey(),
    recentKeys,
    previousNDays(7),
  );

  const days = recentKeys.map((key) => {
    const stat = state.dailyStats[key] ?? {
      attempts: 0,
      correct: 0,
      xp: 0,
    };
    const date = new Date(key + "T12:00:00");
    return {
      key,
      label: messages.stats.weekdays[date.getDay()],
      ...stat,
    };
  });

  const maxAttempts = Math.max(1, ...days.map((item) => item.attempts));

  const labels: Record<SkillKey, [string, string]> = {
    vocabulary: [
      messages.skills.vocabulary.vi,
      messages.skills.vocabulary.ko,
    ],
    grammar: [messages.skills.grammar.vi, messages.skills.grammar.ko],
    listening: [messages.skills.listening.vi, messages.skills.listening.ko],
    speaking: [messages.skills.speaking.vi, messages.skills.speaking.ko],
    reading: [messages.skills.reading.vi, messages.skills.reading.ko],
    writing: [messages.skills.writing.vi, messages.skills.writing.ko],
  };

  const weakest = analytics.weakestSkill
    ? labels[analytics.weakestSkill.key]
    : null;
  const strongest = analytics.strongestSkill
    ? labels[analytics.strongestSkill.key]
    : null;

  return (
    <>
      <section className="stats-strip">
        <article>
          <Flame size={21} />
          <span>{messages.stats.currentStreak}</span>
          <strong>
            {state.streak} {messages.stats.days}
          </strong>
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

      <section className="learning-insight-grid-v4">
        <article className="learning-goal-card-v4">
          <div className="learning-insight-icon-v4">
            <Target size={20} />
          </div>
          <div>
            <span className="eyebrow">MỤC TIÊU HÔM NAY</span>
            <strong>
              {analytics.goalPercent}% · {state.todayXp}/{state.dailyGoal} XP
            </strong>
            <div className="learning-goal-track-v4">
              <span style={{ width: analytics.goalPercent + "%" }} />
            </div>
            <small>
              {analytics.goalRemaining > 0
                ? "Còn " + analytics.goalRemaining + " XP để hoàn thành mục tiêu."
                : "Đã hoàn thành mục tiêu hôm nay."}
            </small>
          </div>
        </article>

        <article className="learning-insight-card-v4">
          <div className="learning-insight-icon-v4 review">
            <RefreshCcw size={20} />
          </div>
          <div>
            <span className="eyebrow">ÔN TẬP ĐẾN HẠN</span>
            <strong>{analytics.dueReviews} mục cần ôn</strong>
            <small>
              {analytics.fragileReviews} mục đang có độ nhớ dưới 60%.
            </small>
          </div>
          <Link className="text-button" href="/review">
            Ôn ngay <ArrowRight size={14} />
          </Link>
        </article>

        <article className="learning-insight-card-v4">
          <div className="learning-insight-icon-v4 mastery">
            <BookOpenCheck size={20} />
          </div>
          <div>
            <span className="eyebrow">TIẾN ĐỘ KHÓA HỌC</span>
            <strong>{analytics.averageLessonProgress}% trung bình</strong>
            <small>
              {analytics.completedLessons} bài đã hoàn thành 100%.
            </small>
          </div>
        </article>

        <article className="learning-insight-card-v4">
          <div className="learning-insight-icon-v4 trend">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="eyebrow">NHỊP HỌC 7 NGÀY</span>
            <strong>
              {analytics.activeDays}/7 ngày · {analytics.recentAttempts} lượt
            </strong>
            <small>
              Độ chính xác {analytics.recentAccuracy}%
              {analytics.accuracyDelta === null
                ? ""
                : analytics.accuracyDelta === 0
                  ? " · không đổi so với tuần trước"
                  : " · " +
                    (analytics.accuracyDelta > 0 ? "+" : "") +
                    analytics.accuracyDelta +
                    " điểm so với tuần trước"}
              .
            </small>
          </div>
        </article>
      </section>

      {weakest || strongest ? (
        <section className="learning-focus-card-v4">
          <div>
            <span className="eyebrow">GỢI Ý HỌC TIẾP</span>
            <h3>
              {weakest
                ? "Ưu tiên " + weakest[0] + " để cân bằng kỹ năng."
                : "Tiếp tục duy trì nhịp học hiện tại."}
            </h3>
            <p>
              {weakest && analytics.weakestSkill
                ? weakest[0] +
                  " đang ở " +
                  analytics.weakestSkill.accuracy +
                  "% sau " +
                  analytics.weakestSkill.attempts +
                  " lượt luyện."
                : ""}
              {strongest && analytics.strongestSkill
                ? " Kỹ năng ổn định nhất hiện tại là " +
                  strongest[0] +
                  " (" +
                  analytics.strongestSkill.accuracy +
                  "%)."
                : ""}
            </p>
          </div>
          {analytics.weakestSkill ? (
            <Link
              className="primary-button"
              href={
                "/practice/quiz?mode=guided&skill=" +
                analytics.weakestSkill.key
              }
            >
              Luyện kỹ năng yếu <ArrowRight size={15} />
            </Link>
          ) : (
            <Link className="primary-button" href="/practice">
              Bắt đầu luyện tập <ArrowRight size={15} />
            </Link>
          )}
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="chart-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{messages.stats.last7Days}</span>
              <h3>{messages.stats.actualAttempts}</h3>
            </div>
            <strong>
              {days.reduce((sum, item) => sum + item.attempts, 0)}{" "}
              {messages.stats.attempts}
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
