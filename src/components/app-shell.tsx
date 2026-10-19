"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Flame,
  Home,
  PencilLine,
  NotebookPen,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
  UserRound,
  UploadCloud,
} from "lucide-react";
import { LearningProvider, useLearning } from "@/lib/learning-state";
import { ContentProvider, useContent } from "@/lib/content-store";
import { I18nProvider, useMessages } from "@/i18n/messages";
import { productConfig } from "@/config/product";
import { AuthProvider, useAuth } from "@/lib/auth-client";
import { FreeLessonNavigation } from "./free-lesson-navigation";
import { LearningLoading } from "@/components/learning-loading";
import { LearningSyncStatus } from "@/components/learning-sync-status";

const navigation = [
  { href: "/", key: "today", icon: Home },
  { href: "/learn", key: "textbook", icon: BookOpenText },
  { href: "/practice", key: "practice", icon: Target },
  { href: "/review", key: "review", icon: RotateCcw },
  { href: "/stats", key: "stats", icon: BarChart3 },
] as const;

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, hydrated: progressHydrated } = useLearning();
  const { course, hydrated: contentHydrated } = useContent();
  const { configured, user } = useAuth();
  const messages = useMessages();

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <div className="auth-shell-v1">{children}</div>;
  }

  const learnerName = user?.name ?? productConfig.defaultLearnerName;
  const profileHref = configured && !user ? "/login" : "/profile";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Đến nội dung học</a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label={productConfig.name}>
          <span className="brand-mark">{productConfig.mark}</span>
          <span>
            <strong>{productConfig.name}</strong>
            <small>{productConfig.koreanSubtitle}</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label={messages.navigation.textbook}>
          {navigation.map(({ href, key, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                className={active ? "nav-item active" : "nav-item"}
                aria-current={active ? "page" : undefined}
                href={href}
                key={href}
              >
                <Icon size={20} strokeWidth={2.1} />
                <span>{messages.navigation[key]}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          className={pathname.startsWith("/practice/drills") ? "nav-item active" : "nav-item"}
          href="/practice/drills"
        >
          <PencilLine size={20} strokeWidth={2.1} />
          <span>Luyện theo dạng bài</span>
        </Link>
        <Link className={pathname.startsWith("/worksheets") ? "nav-item active" : "nav-item"} aria-current={pathname.startsWith("/worksheets") ? "page" : undefined} href="/worksheets">
          <NotebookPen size={20} strokeWidth={2.1} /><span>Vở bài tập</span>
        </Link>

        {user?.role === "admin" ? (
          <Link
            className={pathname.startsWith("/admin") ? "nav-item active admin-nav-item-v1" : "nav-item admin-nav-item-v1"}
            href="/admin"
          >
            <Shield size={20} strokeWidth={2.1} />
            <span>Quản trị</span>
          </Link>
        ) : null}

        <div className="sidebar-spacer" />

        <div className="streak-card">
          <div className="streak-icon">
            <Flame size={19} />
          </div>
          <div>
            <strong>
              {state.streak} {messages.dashboard.days}
            </strong>
            <span>{messages.navigation.streak}</span>
          </div>
        </div>

        <Link
          className={pathname.startsWith("/profile") ? "profile-chip active" : "profile-chip"}
          href={profileHref}
          aria-label={user ? "Mở hồ sơ học tập" : "Đăng nhập Haneul"}
        >
          <div className="avatar">
            {learnerName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{user ? learnerName : configured ? "Đăng nhập" : learnerName}</strong>
            <span>
              {user
                ? (user.role === "admin" ? "Admin" : "Learner") + " · " + state.xp + " XP"
                : configured
                  ? "Đồng bộ tiến độ"
                  : (course.level || messages.common.noData) + " · " + state.xp + " XP"}
            </span>
          </div>
          <UserRound size={17} />
        </Link>
      </aside>

      <main className="app-main" id="main-content">
        {/^\/(worksheets|import|admin)/.test(pathname) ? <div className="flow-location"><span>{pathname.startsWith("/worksheets") ? "Bài tập riêng · không ảnh hưởng tiến độ học" : pathname.startsWith("/import") ? "Giáo trình · nhập và theo dõi biên dịch" : "Học và ôn tập theo giáo trình đang chọn"}</span><nav aria-label="Không gian làm việc Haneul"><Link href="/learn" aria-current={pathname.startsWith("/learn") ? "page" : undefined}><BookOpenText size={15} />Học tập</Link><Link href="/worksheets" aria-current={pathname.startsWith("/worksheets") ? "page" : undefined}><NotebookPen size={15} />Bài tập</Link>{user?.role === "admin" && <Link href="/import" aria-current={pathname.startsWith("/import") ? "page" : undefined}><UploadCloud size={15} />Biên dịch</Link>}</nav></div> : null}
        {!pathname.startsWith("/worksheets") && contentHydrated && course.lessons.length > 0 ? <LearningSyncStatus /> : null}
        {!pathname.startsWith("/worksheets") && (!contentHydrated || (course.lessons.length > 0 && !progressHydrated)) ? <LearningLoading /> : <div key={(pathname.startsWith("/worksheets") ? "worksheets" : course.id) + ":" + (user?.id ?? "guest")}><FreeLessonNavigation />{children}</div>}
      </main>

      <nav className="bottom-nav" aria-label={messages.navigation.textbook}>
        {navigation.map(({ href, key, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              className={active ? "bottom-item active" : "bottom-item"}
              aria-current={active ? "page" : undefined}
              href={href}
              key={href}
            >
              <Icon size={20} strokeWidth={2.2} />
              <span>{messages.navigation[key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mobile-topbar">
        <Link className="mobile-brand" href="/">
          <span className="brand-mark">{productConfig.mark}</span>
          <strong>{productConfig.name}</strong>
        </Link>
        <Link className="mobile-library" href="/worksheets" aria-label="Mở Vở bài tập"><NotebookPen size={20} /></Link>
        <Link
          className="mobile-library"
          href="/practice/drills"
          aria-label="Luyện theo dạng bài"
        >
          <PencilLine size={20} />
        </Link>
        <Link
          className="mobile-library"
          href={profileHref}
          aria-label={user ? "Mở hồ sơ học tập" : "Đăng nhập Haneul"}
        >
          {pathname.startsWith("/profile") ? (
            <Sparkles size={20} />
          ) : (
            <UserRound size={20} />
          )}
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <ContentProvider>
          <LearningProvider>
            <ShellContent>{children}</ShellContent>
          </LearningProvider>
        </ContentProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
