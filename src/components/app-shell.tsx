"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenText, Flame, Home, RotateCcw, Settings, Sparkles, Target } from "lucide-react";
import { LearningProvider, useLearning } from "@/lib/learning-state";
import { ContentProvider } from "@/lib/content-store";
import { I18nProvider, useMessages } from "@/i18n/messages";

const navigation = [
  { href: "/", key: "today", icon: Home },
  { href: "/learn", key: "textbook", icon: BookOpenText },
  { href: "/practice", key: "practice", icon: Target },
  { href: "/review", key: "review", icon: RotateCcw },
  { href: "/stats", key: "stats", icon: BarChart3 },
] as const;

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useLearning();
  const messages = useMessages();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Haneul home">
          <span className="brand-mark">ㅎ</span>
          <span><strong>Haneul</strong><small>한국어 연습</small></span>
        </Link>

        <nav className="side-nav" aria-label={messages.navigation.textbook}>
          {navigation.map(({ href, key, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link className={active ? "nav-item active" : "nav-item"} href={href} key={href}><Icon size={20} strokeWidth={2.1} /><span>{messages.navigation[key]}</span></Link>;
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="streak-card">
          <div className="streak-icon"><Flame size={19} /></div>
          <div><strong>{state.streak} ngày</strong><span>{messages.navigation.streak}</span></div>
        </div>

        <Link className="profile-chip" href="/settings">
          <div className="avatar">H</div>
          <div><strong>Hưng</strong><span>{messages.navigation.beginner} · {state.xp} XP</span></div>
          <Settings size={17} />
        </Link>
      </aside>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label={messages.navigation.textbook}>
        {navigation.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link className={active ? "bottom-item active" : "bottom-item"} href={href} key={href}><Icon size={20} strokeWidth={2.2} /><span>{messages.navigation[key]}</span></Link>;
        })}
      </nav>

      <div className="mobile-topbar">
        <Link className="mobile-brand" href="/"><span className="brand-mark">ㅎ</span><strong>Haneul</strong></Link>
        <Link className="mobile-library" href="/settings" aria-label={messages.navigation.settingsAria}><Sparkles size={20} /></Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <I18nProvider><ContentProvider><LearningProvider><ShellContent>{children}</ShellContent></LearningProvider></ContentProvider></I18nProvider>;
}
