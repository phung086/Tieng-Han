"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Flame,
  Database,
  Gauge,
  LogIn,
  LogOut,
  Medal,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { accuracy, useLearning, type SkillKey } from "@/lib/learning-state";
import { productConfig } from "@/config/product";
import { useAuth } from "@/lib/auth-client";
import { UserAvatarGlyph } from "@/components/user-avatar-glyph";

function formatJoinedAt(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const skillLabels: Record<SkillKey, string> = {
  vocabulary: "Từ vựng",
  grammar: "Ngữ pháp",
  listening: "Nghe",
  speaking: "Nói",
  reading: "Đọc",
  writing: "Viết",
};

export function ProfileClient() {
  const router = useRouter();
  const { course } = useContent();
  const { state } = useLearning();
  const { configured, user, logout } = useAuth();
  const learnerName = user?.name ?? productConfig.defaultLearnerName;
  const joinedAt = formatJoinedAt(user?.joinedAt);

  const totalAttempts = Object.values(state.skills).reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const totalCorrect = Object.values(state.skills).reduce(
    (sum, item) => sum + item.correct,
    0,
  );
  const overallAccuracy = totalAttempts
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;

  const inProgressLessons = course.lessons
    .map((lesson) => ({
      ...lesson,
      progress: state.lessonProgress[String(lesson.id)] ?? 0,
    }))
    .filter((lesson) => lesson.progress > 0 && lesson.progress < 100)
    .slice(0, 3);

  const completedLessons = course.lessons.filter(
    (lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) >= 100,
  ).length;

  const levelNumber = Math.max(1, Math.floor(state.xp / 500) + 1);
  const xpIntoLevel = state.xp % 500;
  const levelProgress = Math.round((xpIntoLevel / 500) * 100);

  const achievements = [
    {
      icon: Flame,
      title: state.streak >= 3 ? "Giữ lửa" : "Khởi động",
      detail:
        state.streak >= 3
          ? state.streak + " ngày học liên tiếp"
          : "Học 3 ngày liên tiếp để mở huy hiệu",
      unlocked: state.streak >= 3,
    },
    {
      icon: Trophy,
      title: "Người chinh phục",
      detail:
        completedLessons > 0
          ? completedLessons + " bài đã hoàn thành"
          : "Hoàn thành bài đầu tiên để mở huy hiệu",
      unlocked: completedLessons > 0,
    },
    {
      icon: Target,
      title: "Chính xác",
      detail:
        overallAccuracy >= 80
          ? overallAccuracy + "% độ chính xác"
          : "Đạt 80% độ chính xác để mở huy hiệu",
      unlocked: overallAccuracy >= 80,
    },
  ];

  return (
    <div className="profile-v2">
      <section className="profile-hero-v2">
        <div className="profile-avatar-v2">
          {user ? (
            <UserAvatarGlyph
              avatarKey={user.avatarKey ?? "cloud"}
              size={38}
            />
          ) : (
            <span>{learnerName.slice(0, 1).toUpperCase()}</span>
          )}
          <i />
        </div>

        <div className="profile-identity-v2">
          <span className="experience-kicker">HANEUL LEARNER</span>
          <h1>{learnerName}</h1>
          <p>
            {user
              ? "Tiến độ đang được đồng bộ theo tài khoản Haneul."
              : configured
                ? "Đăng nhập để đồng bộ tiến độ giữa các thiết bị."
                : "Local-only mode · tiến độ hiện được lưu trên trình duyệt này."}
          </p>
          <div className="profile-tags-v2">
            <span>
              <ShieldCheck size={14} />
              {user ? user.role.toUpperCase() : configured ? "Guest" : "Local profile"}
            </span>
            <span><BookOpenCheck size={14} /> {course.level || "Chưa có cấp độ"}</span>
            {user ? <span><Database size={14} /> {user.email}</span> : null}
            {joinedAt ? (
              <span>
                <CalendarDays size={14} />
                Tham gia {joinedAt}
              </span>
            ) : null}
          </div>
        </div>

        <div className="level-card-v2">
          <span>LEVEL</span>
          <strong>{levelNumber}</strong>
          <div className="level-track-v2">
            <i style={{ width: levelProgress + "%" }} />
          </div>
          <small>{xpIntoLevel}/500 XP tới cấp tiếp theo</small>
        </div>
      </section>

      <section className="profile-metrics-v2">
        <article>
          <span className="metric-icon-v2 purple"><Star size={19} /></span>
          <div><strong>{state.xp}</strong><small>Tổng XP</small></div>
        </article>
        <article>
          <span className="metric-icon-v2 amber"><Flame size={19} /></span>
          <div><strong>{state.streak}</strong><small>Chuỗi ngày</small></div>
        </article>
        <article>
          <span className="metric-icon-v2 mint"><Gauge size={19} /></span>
          <div><strong>{overallAccuracy}%</strong><small>Độ chính xác</small></div>
        </article>
        <article>
          <span className="metric-icon-v2 blue"><CalendarDays size={19} /></span>
          <div><strong>{completedLessons}</strong><small>Bài hoàn thành</small></div>
        </article>
      </section>

      <section className="profile-grid-v2">
        <article className="profile-panel-v2">
          <div className="panel-head-v2">
            <div>
              <span className="experience-kicker">ĐANG HỌC</span>
              <h2>Tiếp tục từ nơi bạn dừng</h2>
            </div>
            <Link href="/learn">Xem lộ trình <ArrowRight size={15} /></Link>
          </div>

          <div className="recent-lessons-v2">
            {(inProgressLessons.length
              ? inProgressLessons
              : course.lessons.slice(0, 2).map((lesson) => ({
                  ...lesson,
                  progress: state.lessonProgress[String(lesson.id)] ?? 0,
                }))
            ).map((lesson) => (
              <Link className="recent-lesson-v2" href={"/learn/" + lesson.id} key={lesson.id}>
                <span className="recent-index-v2">{String(lesson.id).padStart(2, "0")}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.vi}</small>
                  <div className="recent-progress-v2">
                    <i style={{ width: lesson.progress + "%" }} />
                  </div>
                </div>
                <span>{lesson.progress}%</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="profile-panel-v2 skill-profile-panel-v2">
          <div className="panel-head-v2">
            <div>
              <span className="experience-kicker">HIỆU SUẤT</span>
              <h2>Kỹ năng của bạn</h2>
            </div>
            <Link href="/stats">Chi tiết <ArrowRight size={15} /></Link>
          </div>

          <div className="profile-skills-v2">
            {(Object.keys(skillLabels) as SkillKey[]).map((key) => {
              const value = accuracy(state.skills[key]);
              return (
                <div className="profile-skill-row-v2" key={key}>
                  <div>
                    <strong>{skillLabels[key]}</strong>
                    <span>{state.skills[key].correct}/{state.skills[key].total || 0}</span>
                  </div>
                  <div className="profile-skill-track-v2">
                    <i style={{ width: value + "%" }} />
                  </div>
                  <strong>{value}%</strong>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="profile-grid-v2 bottom">
        <article className="profile-panel-v2">
          <div className="panel-head-v2">
            <div>
              <span className="experience-kicker">THÀNH TỰU</span>
              <h2>Huy hiệu gần đây</h2>
            </div>
          </div>
          <div className="achievement-grid-v2">
            {achievements.map(({ icon: Icon, title, detail, unlocked }) => (
              <div className={unlocked ? "achievement-v2 unlocked" : "achievement-v2"} key={title}>
                <span><Icon size={21} /></span>
                <div><strong>{title}</strong><small>{detail}</small></div>
              </div>
            ))}
          </div>
        </article>

        <article className="account-future-v2">
          <div className="future-icon-v2"><UserRound size={27} /></div>
          <span className="experience-kicker">
            {user ? "ACCOUNT SYNC" : "HANEUL ACCOUNT"}
          </span>
          <h2>
            {user
              ? "Tài khoản đã được kết nối"
              : configured
                ? "Đăng nhập để đồng bộ"
                : "Local-only mode"}
          </h2>
          <p>
            {user
              ? "XP, mastery, tiến độ từng giáo trình và enrollment được lưu theo tài khoản trong PostgreSQL."
              : configured
                ? "Bạn vẫn có thể học cục bộ, nhưng đăng nhập sẽ giúp giữ tiến độ theo tài khoản."
                : "Database chưa được cấu hình nên Haneul tiếp tục dùng localStorage/IndexedDB như trước."}
          </p>
          <div className="profile-account-actions-v1">
            {user ? (
              <>
                {user.role === "admin" ? (
                  <Link className="secondary-button" href="/admin">
                    <ShieldCheck size={16} /> Quản trị
                  </Link>
                ) : null}
                <button
                  className="secondary-button"
                  onClick={() => {
                    void logout().then(() => {
                      router.replace("/login");
                      router.refresh();
                    });
                  }}
                  type="button"
                >
                  <LogOut size={16} /> Đăng xuất
                </button>
              </>
            ) : configured ? (
              <Link className="primary-button" href="/login">
                <LogIn size={16} /> Đăng nhập
              </Link>
            ) : (
              <Link className="secondary-button" href="/settings">
                <Settings size={16} /> Cài đặt hiện tại
              </Link>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
