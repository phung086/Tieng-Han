"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Flame,
  Home,
  LibraryBig,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Hôm nay", icon: Home },
  { href: "/learn", label: "Giáo trình", icon: BookOpenText },
  { href: "/practice", label: "Luyện tập", icon: Target },
  { href: "/review", label: "Ôn lại", icon: RotateCcw },
  { href: "/stats", label: "Tiến độ", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Haneul home">
          <span className="brand-mark">ㅎ</span>
          <span>
            <strong>Haneul</strong>
            <small>한국어 연습</small>
          </span>
        </Link>

        <nav className="side-nav" aria-label="Điều hướng chính">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link className={active ? "nav-item active" : "nav-item"} href={href} key={href}>
                <Icon size={20} strokeWidth={2.1} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="streak-card">
          <div className="streak-icon"><Flame size={19} /></div>
          <div>
            <strong>7 ngày</strong>
            <span>Chuỗi học hiện tại</span>
          </div>
        </div>

        <div className="profile-chip">
          <div className="avatar">H</div>
          <div>
            <strong>Hưng</strong>
            <span>Sơ cấp 1</span>
          </div>
          <Sparkles size={17} />
        </div>
      </aside>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {navigation.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link className={active ? "bottom-item active" : "bottom-item"} href={href} key={href}>
              <Icon size={20} strokeWidth={2.2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mobile-topbar">
        <Link className="mobile-brand" href="/">
          <span className="brand-mark">ㅎ</span>
          <strong>Haneul</strong>
        </Link>
        <Link className="mobile-library" href="/learn" aria-label="Mở giáo trình">
          <LibraryBig size={20} />
        </Link>
      </div>
    </div>
  );
}
