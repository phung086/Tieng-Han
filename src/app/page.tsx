"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Flame,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { HaneulMascot } from "@/components/haneul-mascot";
import { EmptyCourseState } from "@/components/empty-course-state";
import { useContent } from "@/lib/content-store";
import {
  accuracy,
  todayKey,
  useLearning,
  type SkillKey,
} from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";

const skillTones: Record<SkillKey, string> = {
  vocabulary: "violet",
  grammar: "blue",
  listening: "mint",
  speaking: "coral",
  reading: "amber",
  writing: "rose",
};

export default function DashboardPage() {
  const { state } = useLearning();
  const { course } = useContent();
  const messages = useMessages();

  if (!course.lessons.length) {
    return (
      <div className="page dashboard-page">
        <EmptyCourseState />
      </div>
    );
  }

  const today = todayKey();
  const current =
    course.lessons.find(
      (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100,
    ) ?? course.lessons[course.lessons.length - 1];

  const currentProgress = state.lessonProgress[String(current.id)] ?? 0;
  const courseProgress = Math.round(
    course.lessons.reduce(
      (sum, lesson) =>
        sum + (state.lessonProgress[String(lesson.id)] ?? 0),
      0,
    ) / Math.max(1, course.lessons.length),
  );
  const completedLessons = course.lessons.filter(
    (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) >= 100,
  ).length;
  const dueCount = Object.values(state.mastery).filter(
    (item) => item.dueAt <= today,
  ).length;
  const completedCurrentSkills = state.completedActivities.filter((id) =>
    id.startsWith("lesson:" + current.id + ":"),
  ).length;
  const goalProgress = Math.min(
    100,
    Math.round((state.todayXp / Math.max(1, state.dailyGoal)) * 100),
  );

  return (
    <div className="page dashboard-page">
      <header className="game-topbar">
        <div>
          <span className="game-kicker">HANEUL ADVENTURE</span>
          <h1>Hôm nay mình học gì?</h1>
          <p>Mỗi chặng nhỏ là một bước tiến gần hơn đến phản xạ tiếng Hàn tự nhiên.</p>
        </div>

        <div className="game-hud" aria-label="Tiến độ hôm nay">
          <div className="hud-chip streak">
            <Flame size={18} />
            <span>{state.streak} ngày</span>
          </div>
          <div className="hud-chip xp">
            <Star size={18} />
            <span>{state.xp} XP</span>
          </div>
          <div className="hud-chip goal">
            <Target size={18} />
            <span>{state.todayXp}/{state.dailyGoal}</span>
          </div>
        </div>
      </header>

      <section className="game-hero">
        <div className="game-hero-copy">
          <span className="hero-label">
            <Sparkles size={14} />
            Tiếp tục hành trình
          </span>
          <h2>{current.title}</h2>
          <p>{current.vi} · {current.objective}</p>

          <div className="hero-progress-line">
            <div className="hero-progress-track">
              <span style={{ width: currentProgress + "%" }} />
            </div>
            <strong>{currentProgress}%</strong>
          </div>

          <Link className="primary-button" href={"/learn/" + current.id}>
            Học tiếp
            <ArrowRight size={18} />
          </Link>
        </div>

        <div className="game-hero-visual">
          <HaneulMascot size="lg" />
          <div className="hero-level-bubble">
            Bài {current.id} · {completedCurrentSkills}/6 kỹ năng
          </div>
        </div>
      </section>

      <section className="quest-grid" aria-label="Nhiệm vụ học tập">
        <article className="quest-card review">
          <div className="quest-icon">
            <RotateCcw size={24} />
          </div>
          <h3>Ôn tập hôm nay</h3>
          <p>
            {dueCount
              ? dueCount + " nội dung đang đến hạn ôn lại."
              : "Chưa có nội dung quá hạn. Bạn đang giữ nhịp rất tốt."}
          </p>
          <Link className="text-button" href="/review">
            Mở ôn tập <ArrowRight size={15} />
          </Link>
        </article>

        <article className="quest-card daily">
          <div className="quest-icon">
            <Target size={24} />
          </div>
          <h3>Nhiệm vụ ngày</h3>
          <p>Kiếm {state.dailyGoal} XP để giữ chuỗi học đều đặn.</p>
          <div className="quest-progress">
            <span style={{ width: goalProgress + "%" }} />
          </div>
          <strong>{state.todayXp} / {state.dailyGoal} XP</strong>
        </article>

        <article className="quest-card course">
          <div className="quest-icon">
            <Trophy size={24} />
          </div>
          <h3>Hành trình giáo trình</h3>
          <p>
            Đã hoàn thành {completedLessons}/{course.lessons.length} bài · tổng tiến độ {courseProgress}%.
          </p>
          <Link className="text-button" href="/learn">
            Xem bản đồ học <ArrowRight size={15} />
          </Link>
        </article>
      </section>

      <section>
        <div className="game-section-title">
          <div>
            <span className="game-kicker">SKILL ISLANDS</span>
            <h2>6 kỹ năng của bạn</h2>
          </div>
          <Link className="text-button" href="/stats">
            Xem thống kê <ArrowRight size={15} />
          </Link>
        </div>

        <div className="skill-islands">
          {(Object.keys(skillTones) as SkillKey[]).map((key) => {
            const score = accuracy(state.skills[key]);
            const label = messages.skills[key];
            return (
              <article
                className={"skill-island tone-" + skillTones[key]}
                key={key}
              >
                <span className="skill-korean">{label.ko}</span>
                <h3>{label.vi}</h3>
                <strong className="skill-score">{score}%</strong>
                <div className="mini-progress">
                  <span style={{ width: score + "%" }} />
                </div>
                <p>
                  {state.skills[key].total
                    ? state.skills[key].correct +
                      "/" +
                      state.skills[key].total +
                      " câu đúng"
                    : "Chưa bắt đầu"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="game-section-title">
        <div>
          <span className="game-kicker">QUICK START</span>
          <h2>Vào học ngay</h2>
        </div>
        <Link className="secondary-button small" href={"/learn/" + current.id}>
          <BookOpen size={16} />
          Bài {current.id}
        </Link>
      </section>
    </div>
  );
}
