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
import { ActiveCourseChip } from "@/components/active-course-chip";
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

const skillTone: Record<SkillKey, string> = {
  vocabulary: "purple",
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
  const completedLessons = course.lessons.filter(
    (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) >= 100,
  ).length;
  const courseProgress = Math.round(
    course.lessons.reduce(
      (sum, lesson) =>
        sum + (state.lessonProgress[String(lesson.id)] ?? 0),
      0,
    ) / Math.max(1, course.lessons.length),
  );
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
    <div className="page home-v2">
      <header className="home-head-v2">
        <div>
          <span className="experience-kicker">HANEUL SKY JOURNEY</span>
          <h1>오늘도 한 걸음 더.</h1>
          <p>
            Một phiên ngắn hôm nay vẫn đủ để giữ nhịp và tiến gần hơn đến phản xạ tự nhiên.
          </p>
          <ActiveCourseChip compact />
        </div>

        <div className="home-hud-v2" aria-label="Chỉ số học hôm nay">
          <div className="home-hud-pill-v2 flame">
            <Flame size={18} />
            {state.streak} ngày
          </div>
          <div className="home-hud-pill-v2 star">
            <Star size={18} />
            {state.xp} XP
          </div>
          <div className="home-hud-pill-v2 target">
            <Target size={18} />
            {state.todayXp}/{state.dailyGoal}
          </div>
        </div>
      </header>

      <section className="home-layout-v2">
        <article className="adventure-card-v2">
          <div className="adventure-copy-v2">
            <span className="adventure-label-v2">
              <Sparkles size={14} />
              Tiếp tục hành trình
            </span>
            <h2>{current.title}</h2>
            <p>
              {current.vi} · {current.objective}
            </p>

            <div className="adventure-progress-v2">
              <div className="adventure-track-v2">
                <i style={{ width: currentProgress + "%" }} />
              </div>
              <strong>{currentProgress}%</strong>
            </div>

            <div className="adventure-actions-v2">
              <Link className="primary-button" href={"/learn/" + current.id}>
                Học tiếp
                <ArrowRight size={18} />
              </Link>
              <Link className="ghost-game-button-v2" href="/learn">
                <BookOpen size={16} />
                Xem bản đồ
              </Link>
            </div>
          </div>

          <div className="adventure-visual-v2">
            <span className="adventure-orbit-v2" />
            <HaneulMascot size="lg" />
            <div className="current-badge-v2">
              Bài {current.id} · {completedCurrentSkills}/6 kỹ năng
            </div>
          </div>
        </article>

        <aside className="mission-stack-v2">
          <article className="mission-card-v2 review">
            <div className="mission-icon-v2">
              <RotateCcw size={23} />
            </div>
            <div>
              <strong>Ôn đúng lúc</strong>
              <p>
                {dueCount
                  ? dueCount + " mục đang đến hạn hôm nay."
                  : "Hàng đợi sạch. Bạn đang giữ trí nhớ rất ổn."}
              </p>
            </div>
            <Link href="/review" aria-label="Mở ôn tập">
              <ArrowRight size={16} />
            </Link>
          </article>

          <article className="mission-card-v2 goal">
            <div className="mission-icon-v2">
              <Target size={23} />
            </div>
            <div>
              <strong>Mục tiêu ngày</strong>
              <p>
                {state.todayXp}/{state.dailyGoal} XP · {goalProgress}% hoàn thành.
              </p>
            </div>
            <Link href="/practice" aria-label="Mở luyện tập">
              <ArrowRight size={16} />
            </Link>
          </article>

          <article className="mission-card-v2 course">
            <div className="mission-icon-v2">
              <Trophy size={23} />
            </div>
            <div>
              <strong>{completedLessons}/{course.lessons.length} bài</strong>
              <p>
                Tổng tiến độ giáo trình hiện tại: {courseProgress}%.
              </p>
            </div>
            <Link href="/learn" aria-label="Mở lộ trình">
              <ArrowRight size={16} />
            </Link>
          </article>
        </aside>
      </section>

      <section className="home-section-v2">
        <div className="section-head-v2">
          <div>
            <span className="experience-kicker">SKILL CONSTELLATION</span>
            <h2>6 kỹ năng trên cùng một bầu trời</h2>
          </div>
          <Link href="/stats">
            Xem hiệu suất
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="skill-deck-v2">
          {(Object.keys(skillTone) as SkillKey[]).map((key) => {
            const score = accuracy(state.skills[key]);
            const label = messages.skills[key];
            return (
              <article
                className={"skill-card-v2 " + skillTone[key]}
                key={key}
              >
                <span>{label.ko}</span>
                <h3>{label.vi}</h3>
                <strong>{score}%</strong>
                <small>
                  {state.skills[key].total
                    ? state.skills[key].correct +
                      "/" +
                      state.skills[key].total +
                      " lượt đúng"
                    : "Chưa có dữ liệu"}
                </small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-section-v2">
        <div className="section-head-v2">
          <div>
            <span className="experience-kicker">YOUR SPACE</span>
            <h2>Tiến độ này là của riêng bạn</h2>
          </div>
          <Link href="/profile">
            Mở hồ sơ
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
