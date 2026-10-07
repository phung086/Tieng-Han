"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  LogIn,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";

type SessionView = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
};

function sessionLabel(userAgent: string | null) {
  if (!userAgent) return "Thiết bị không xác định";

  const platform = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Thiết bị";

  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /Chrome\//i.test(userAgent)
      ? "Chrome"
      : /Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Browser";

  return platform + " · " + browser;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountSettings() {
  const router = useRouter();
  const { configured, user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.current),
    [sessions],
  );

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  async function loadSessions() {
    if (!user) {
      setSessions([]);
      return;
    }

    try {
      const response = await fetch("/api/me/sessions", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        sessions?: SessionView[];
      };
      setSessions(data.sessions ?? []);
    } catch {
      // Account controls remain usable without the session list.
    }
  }

  useEffect(() => {
    void loadSessions();
  }, [user?.id]);

  function begin(key: string) {
    setPending(key);
    setError("");
    setMessage("");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || pending) return;
    begin("profile");

    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể cập nhật hồ sơ.");
        return;
      }

      await refresh();
      setMessage("Đã cập nhật tên hiển thị.");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending("");
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || pending) return;
    begin("password");

    try {
      const response = await fetch("/api/me/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể đổi mật khẩu.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      await loadSessions();
      setMessage(
        "Đã đổi mật khẩu và đăng xuất các thiết bị khác.",
      );
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending("");
    }
  }

  async function revokeSession(session: SessionView) {
    if (!user || pending) return;
    begin("session:" + session.id);

    try {
      const response = await fetch("/api/me/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          sessionId: session.id,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể đăng xuất phiên này.");
        return;
      }

      if (session.current) {
        await refresh();
        router.replace("/login");
        router.refresh();
        return;
      }

      await loadSessions();
      setMessage("Đã thu hồi phiên đăng nhập.");
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending("");
    }
  }

  async function revokeOthers() {
    if (!user || pending || !otherSessions.length) return;
    begin("sessions");

    try {
      const response = await fetch("/api/me/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revokeOthers" }),
      });
      const data = (await response.json()) as {
        error?: string;
        revoked?: number;
      };

      if (!response.ok) {
        setError(data.error ?? "Không thể đăng xuất thiết bị khác.");
        return;
      }

      await loadSessions();
      setMessage(
        "Đã đăng xuất " + (data.revoked ?? otherSessions.length) + " phiên khác.",
      );
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setPending("");
    }
  }

  if (!configured) return null;

  if (!user) {
    return (
      <section className="account-settings-card-v2 account-login-card-v2">
        <div className="settings-icon">
          <UserRound size={21} />
        </div>
        <div>
          <span className="experience-kicker">ACCOUNT</span>
          <h2>Đăng nhập để quản lý tài khoản</h2>
          <p>
            Khi đăng nhập, tiến độ được đồng bộ theo tài khoản và bạn có thể
            quản lý hồ sơ, mật khẩu và các phiên đăng nhập.
          </p>
        </div>
        <Link className="primary-button" href="/login?next=/settings">
          <LogIn size={16} /> Đăng nhập
        </Link>
      </section>
    );
  }

  return (
    <section className="account-settings-v2">
      <div className="account-settings-head-v2">
        <div>
          <span className="experience-kicker">ACCOUNT & SECURITY</span>
          <h2>Tài khoản Haneul</h2>
          <p>{user.email} · {user.role}</p>
        </div>
        <span className="settings-badge good">
          <ShieldCheck size={13} /> Đã đồng bộ
        </span>
      </div>

      {message ? (
        <div className="account-message-v2 success" role="status">
          <CheckCircle2 size={16} /> {message}
        </div>
      ) : null}
      {error ? (
        <div className="account-message-v2 error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="account-settings-grid-v2">
        <form className="account-form-v2" onSubmit={saveProfile}>
          <div className="account-form-title-v2">
            <UserRound size={18} />
            <div>
              <strong>Hồ sơ</strong>
              <span>Tên hiển thị trên Haneul</span>
            </div>
          </div>
          <label>
            <span>Tên hiển thị</span>
            <input
              maxLength={80}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <button
            className="secondary-button"
            disabled={
              pending === "profile" ||
              name.trim() === user.name.trim()
            }
            type="submit"
          >
            {pending === "profile" ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
        </form>

        <form className="account-form-v2" onSubmit={changePassword}>
          <div className="account-form-title-v2">
            <KeyRound size={18} />
            <div>
              <strong>Mật khẩu</strong>
              <span>Đổi mật khẩu và thu hồi session cũ</span>
            </div>
          </div>
          <label>
            <span>Mật khẩu hiện tại</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label>
            <span>Mật khẩu mới</span>
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <button
            className="secondary-button"
            disabled={pending === "password"}
            type="submit"
          >
            {pending === "password" ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
        </form>
      </div>

      <div className="session-panel-v2">
        <div className="session-panel-head-v2">
          <div>
            <span className="experience-kicker">ACTIVE SESSIONS</span>
            <h3>Thiết bị đang đăng nhập</h3>
          </div>
          <button
            className="text-button"
            disabled={!otherSessions.length || pending === "sessions"}
            onClick={() => void revokeOthers()}
            type="button"
          >
            Đăng xuất thiết bị khác
          </button>
        </div>

        <div className="session-list-v2">
          {sessions.map((session) => (
            <article key={session.id}>
              <span className={session.current ? "session-device-v2 current" : "session-device-v2"}>
                {session.current ? (
                  <MonitorSmartphone size={18} />
                ) : (
                  <Laptop size={18} />
                )}
              </span>
              <div>
                <strong>
                  {sessionLabel(session.userAgent)}
                  {session.current ? " · Thiết bị này" : ""}
                </strong>
                <span>
                  Hoạt động {formatDate(session.lastSeenAt)} · hết hạn{" "}
                  {formatDate(session.expiresAt)}
                </span>
              </div>
              <button
                className="text-button"
                disabled={pending === "session:" + session.id}
                onClick={() => void revokeSession(session)}
                type="button"
              >
                {session.current ? "Đăng xuất" : "Thu hồi"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
