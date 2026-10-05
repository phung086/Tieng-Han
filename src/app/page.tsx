"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ChevronRight, Clock3, Headphones, Sparkles } from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";
import { DashboardLiveStats } from "@/components/dashboard-live-stats";
import { useContent } from "@/lib/content-store";
import { accuracy, todayKey, useLearning, type SkillKey } from "@/lib/learning-state";

const skillMeta: Record<SkillKey, { name: string; korean: string; tone: string }> = {
  vocabulary: { name: "Từ vựng", korean: "어휘", tone: "violet" },
  grammar: { name: "Ngữ pháp", korean: "문법", tone: "blue" },
  listening: { name: "Nghe", korean: "듣기", tone: "mint" },
  speaking: { name: "Nói", korean: "말하기", tone: "coral" },
  reading: { name: "Đọc", korean: "읽기", tone: "amber" },
  writing: { name: "Viết", korean: "쓰기", tone: "rose" },
};

function skillNote(value: number, total: number) {
  if (!total) return "Chưa có lượt luyện";
  if (value < 60) return "Nên ưu tiên hôm nay";
  if (value < 80) return "Đang tiến bộ";
  return "Đang khá vững";
}

export default function DashboardPage() {
  const { state } = useLearning();
  const { course } = useContent();
  const today = todayKey();
  const todayStat = state.dailyStats[today] ?? { attempts: 0, correct: 0, xp: 0 };
  const current =
    course.lessons.find((lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100) ??
    course.lessons[course.lessons.length - 1];
  const currentProgress = state.lessonProgress[String(current.id)] ?? 0;
  const courseProgress = Math.round(
    course.lessons.reduce((sum, lesson) => sum + (state.lessonProgress[String(lesson.id)] ?? 0), 0) /
      Math.max(1, course.lessons.length),
  );
  const dueCount = Object.values(state.mastery).filter((item) => item.dueAt <= today).length;
  const completedCurrentSkills = state.completedActivities.filter((id) => id.startsWith("lesson:" + current.id + ":")).length;
  const goalProgress = Math.min(100, Math.round((state.todayXp / Math.max(1, state.dailyGoal)) * 100));

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <span className="kicker">오늘의 학습 · HÔM NAY</span>
          <h1>좋은 하루예요, Hưng 👋</h1>
          <p>Mở app là biết ngay nên làm gì tiếp theo. Không cần tự chọn quá nhiều.</p>
        </div>
        <DashboardLiveStats />
      </header>

      <section className="dashboard-grid">
        <article className="continue-card">
          <div className="continue-copy">
            <span className="pill pill-soft">Tiếp tục học</span>
            <div className="lesson-index">Bài {current.id} · {course.level}</div>
            <h2>{current.title}</h2>
            <p>{current.vi} · {current.objective}</p>
            <div className="continue-meta">
              <span><Clock3 size={16} /> {completedCurrentSkills}/6 kỹ năng xong</span>
              <span><BookOpen size={16} /> {currentProgress}% bài học</span>
            </div>
            <Link className="primary-button" href={"/learn/" + current.id}>Học tiếp <ArrowRight size={18} /></Link>
          </div>
          <div className="continue-visual">
            <div className="float-word word-one">학교</div><div className="float-word word-two">어디</div><div className="float-word word-three">갑니다</div>
            <ProgressRing value={currentProgress} size={132} label="hoàn thành" />
          </div>
        </article>

        <article className="today-card">
          <div className="card-heading">
            <div><span className="eyebrow">Ôn hôm nay</span><h3>{dueCount ? dueCount + " mục đến hạn" : "Không có mục quá hạn"}</h3></div>
            <span className="review-count">{dueCount}</span>
          </div>
          <div className="review-breakdown">
            <div><span className="dot violet" /><span>{todayStat.attempts} lượt đã luyện</span><strong>오늘</strong></div>
            <div><span className="dot blue" /><span>{todayStat.correct} lượt đúng</span><strong>정답</strong></div>
            <div><span className="dot mint" /><span>{state.todayXp}/{state.dailyGoal} XP mục tiêu</span><strong>XP</strong></div>
          </div>
          <Link className="secondary-button wide" href="/review">{dueCount ? "Ôn các mục đến hạn" : "Xem hàng đợi ôn"} <ChevronRight size={18} /></Link>
        </article>
      </section>

      <section className="section-block">
        <div className="section-title-row">
          <div><span className="eyebrow">Kỹ năng của bạn</span><h2>Học đều, nhưng tập trung đúng chỗ yếu</h2></div>
          <Link href="/stats">Xem tiến độ <ArrowRight size={16} /></Link>
        </div>
        <div className="skill-grid">
          {(Object.keys(skillMeta) as SkillKey[]).map((key) => {
            const meta = skillMeta[key];
            const score = accuracy(state.skills[key]);
            return (
              <article className={"skill-card tone-" + meta.tone} key={key}>
                <div className="skill-top"><div><span className="skill-korean">{meta.korean}</span><h3>{meta.name}</h3></div><strong>{score}%</strong></div>
                <div className="mini-progress"><span style={{ width: score + "%" }} /></div>
                <p>{skillNote(score, state.skills[key].total)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="path-preview">
          <div className="card-heading"><div><span className="eyebrow">Lộ trình giáo trình</span><h3>{course.title}</h3></div><span className="course-progress">{courseProgress}%</span></div>
          <div className="path-list">
            {course.lessons.slice(Math.max(0, current.id - 2), Math.min(course.lessons.length, current.id + 2)).map((lesson) => {
              const progress = state.lessonProgress[String(lesson.id)] ?? 0;
              const status = progress >= 100 ? "done" : lesson.id === current.id ? "current" : "locked";
              return (
                <div className={"path-row " + status} key={lesson.id}>
                  <div className="path-node">{status === "done" ? "✓" : lesson.id}</div>
                  <div><strong>{lesson.title}</strong><span>{lesson.vi}</span></div>
                  {status === "current" ? <span className="current-tag">Đang học</span> : null}
                </div>
              );
            })}
          </div>
          <Link className="text-button" href="/learn">Mở toàn bộ giáo trình <ArrowRight size={16} /></Link>
        </article>

        <article className="daily-mission">
          <div className="mission-icon"><Headphones size={28} /></div>
          <span className="eyebrow">Mục tiêu hôm nay</span>
          <h3>{state.todayXp >= state.dailyGoal ? "Bạn đã đạt mục tiêu hôm nay 🎉" : "Hoàn thành " + state.dailyGoal + " XP hôm nay"}</h3>
          <p>{state.todayXp >= state.dailyGoal ? "Có thể ôn nhẹ hoặc dừng ở đây." : "Chỉ cần một phiên ngắn nữa để giữ nhịp học."}</p>
          <div className="mission-progress"><span style={{ width: goalProgress + "%" }} /></div>
          <div className="mission-footer"><span>{state.todayXp} / {state.dailyGoal} XP</span><Link href={"/listening?lesson=" + current.id}><Sparkles size={16} /> Luyện ngay</Link></div>
        </article>
      </section>
    </div>
  );
}
