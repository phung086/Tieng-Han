"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  LockKeyhole,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-client";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export function AuthForm({
  mode,
}: {
  mode: "login" | "register";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { configured, loading, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            isRegister
              ? { name, email, password }
              : { email, password },
          ),
        },
      );
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Không thể xác thực tài khoản.");
        return;
      }

      await refresh();
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page-v1">
      <section className="auth-card-v1">
        <div className="auth-brand-v1">
          <span><Sparkles size={24} /></span>
          <div>
            <strong>Haneul</strong>
            <small>하늘 · personal learning cloud</small>
          </div>
        </div>

        <div className="auth-copy-v1">
          <span className="experience-kicker">
            {isRegister ? "CREATE LEARNER ACCOUNT" : "WELCOME BACK"}
          </span>
          <h1>
            {isRegister
              ? "Tạo tài khoản học của riêng bạn."
              : "Tiếp tục đúng nơi bạn đã dừng."}
          </h1>
          <p>
            Tiến độ, XP, mastery và giáo trình sẽ đồng bộ theo tài khoản khi PostgreSQL được bật.
          </p>
        </div>

        {!loading && !configured ? (
          <div className="auth-setup-note-v1">
            <strong>Authentication chưa được bật.</strong>
            <p>
              Cấu hình DATABASE_URL và chạy <code>pnpm db:migrate</code>. Haneul hiện vẫn hoạt động ở local-only mode.
            </p>
          </div>
        ) : null}

        <form className="auth-form-v1" onSubmit={submit}>
          {isRegister ? (
            <label>
              <span>Tên hiển thị</span>
              <div>
                <UserRound size={17} />
                <input
                  autoComplete="name"
                  disabled={!configured || pending}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Hưng"
                  required
                  value={name}
                />
              </div>
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <div>
              <AtSign size={17} />
              <input
                autoComplete="email"
                disabled={!configured || pending}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
          </label>

          <label>
            <span>Mật khẩu</span>
            <div>
              <LockKeyhole size={17} />
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                disabled={!configured || pending}
                minLength={isRegister ? 10 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? "Tối thiểu 10 ký tự" : "Nhập mật khẩu"}
                required
                type="password"
                value={password}
              />
            </div>
          </label>

          {error ? <div className="auth-error-v1">{error}</div> : null}

          <button
            className="primary-button auth-submit-v1"
            disabled={!configured || pending}
            type="submit"
          >
            {pending
              ? "Đang xử lý…"
              : isRegister
                ? "Tạo tài khoản"
                : "Đăng nhập"}
            {!pending ? <ArrowRight size={17} /> : null}
          </button>
        </form>

        <div className="auth-switch-v1">
          <span>
            {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
          </span>
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Đăng nhập" : "Đăng ký"}
          </Link>
        </div>
      </section>

      <aside className="auth-side-v1">
        <span className="experience-kicker">PHASE SCALE 1</span>
        <h2>Giữ nguyên flow học. Chỉ thêm lớp tài khoản và đồng bộ.</h2>
        <div className="auth-benefits-v1">
          <article>
            <strong>01</strong>
            <div>
              <h3>Tiến độ theo người dùng</h3>
              <p>Không còn phụ thuộc duy nhất vào một trình duyệt.</p>
            </div>
          </article>
          <article>
            <strong>02</strong>
            <div>
              <h3>Vai trò rõ ràng</h3>
              <p>Learner học; admin quản trị nội dung và import.</p>
            </div>
          </article>
          <article>
            <strong>03</strong>
            <div>
              <h3>Không đụng compiler</h3>
              <p>MCP Events, checkpoint và source grounding vẫn nguyên vẹn.</p>
            </div>
          </article>
        </div>
      </aside>
    </div>
  );
}
