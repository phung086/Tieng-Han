import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { cookies } from "next/headers";
import { dbQuery, isDatabaseConfigured } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";
import type { AuthUser, UserRole } from "@/lib/auth/types";

const SESSION_COOKIE = "haneul_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
};

export type UserSessionView = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  current: boolean;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_credentials"
      | "invalid_password"
      | "email_taken"
      | "disabled",
  ) {
    super(message);
  }
}

function publicUser(
  row: Pick<UserRow, "id" | "email" | "name" | "role">,
): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getCurrentSessionTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? hashSessionToken(token) : null;
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  if (!isDatabaseConfigured()) {
    throw new AuthError(
      "PostgreSQL chưa được cấu hình.",
      "not_configured",
    );
  }

  const email = normalizeEmail(input.email);
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const role: UserRole = "learner";

  try {
    const result = await dbQuery<UserRow>(
      `
        INSERT INTO haneul_users
          (id, email, name, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, role, password_hash
      `,
      [id, email, input.name.trim(), passwordHash, role],
    );

    return publicUser(result.rows[0]);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthError(
        "Email này đã được đăng ký.",
        "email_taken",
      );
    }
    throw error;
  }
}

export async function verifyUserCredentials(
  emailInput: string,
  password: string,
) {
  if (!isDatabaseConfigured()) {
    throw new AuthError(
      "PostgreSQL chưa được cấu hình.",
      "not_configured",
    );
  }

  const email = normalizeEmail(emailInput);
  const result = await dbQuery<UserRow & { status: string }>(
    `
      SELECT id, email, name, role, password_hash, status
      FROM haneul_users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );
  const row = result.rows[0];

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new AuthError(
      "Email hoặc mật khẩu không đúng.",
      "invalid_credentials",
    );
  }

  if (row.status !== "active") {
    throw new AuthError(
      "Tài khoản đang bị vô hiệu hóa.",
      "disabled",
    );
  }

  await dbQuery(
    "UPDATE haneul_users SET last_login_at = NOW() WHERE id = $1",
    [row.id],
  );

  return publicUser(row);
}

export async function createSession(
  user: AuthUser,
  userAgent?: string | null,
) {
  if (!isDatabaseConfigured()) {
    throw new AuthError(
      "PostgreSQL chưa được cấu hình.",
      "not_configured",
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE * 1_000,
  );
  const sessionId = randomUUID();

  await dbQuery(
    `
      INSERT INTO haneul_auth_sessions
        (id, user_id, token_hash, expires_at, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      sessionId,
      user.id,
      tokenHash,
      expiresAt,
      userAgent?.slice(0, 500) ?? null,
    ],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isDatabaseConfigured()) return null;

  const tokenHash = await getCurrentSessionTokenHash();
  if (!tokenHash) return null;

  const result = await dbQuery<UserRow & { session_id: string }>(
    `
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.password_hash,
        s.id AS session_id
      FROM haneul_auth_sessions s
      JOIN haneul_users u ON u.id = s.user_id
      WHERE
        s.token_hash = $1
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1
    `,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) return null;

  await dbQuery(
    `
      UPDATE haneul_auth_sessions
      SET last_seen_at = NOW()
      WHERE
        id = $1
        AND last_seen_at < NOW() - INTERVAL '5 minutes'
    `,
    [row.session_id],
  );

  return publicUser(row);
}

export async function destroyCurrentSession() {
  if (!isDatabaseConfigured()) return;

  const tokenHash = await getCurrentSessionTokenHash();

  if (tokenHash) {
    await dbQuery(
      "DELETE FROM haneul_auth_sessions WHERE token_hash = $1",
      [tokenHash],
    );
  }

  await clearSessionCookie();
}

export async function updateCurrentUserProfile(
  userId: string,
  input: { name: string },
) {
  const result = await dbQuery<UserRow>(
    `
      UPDATE haneul_users
      SET name = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING id, email, name, role, password_hash
    `,
    [userId, input.name.trim()],
  );

  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

export async function changeCurrentUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}) {
  const result = await dbQuery<UserRow>(
    `
      SELECT id, email, name, role, password_hash
      FROM haneul_users
      WHERE id = $1 AND status = 'active'
      LIMIT 1
    `,
    [input.userId],
  );
  const row = result.rows[0];

  if (!row || !(await verifyPassword(input.currentPassword, row.password_hash))) {
    throw new AuthError(
      "Mật khẩu hiện tại không đúng.",
      "invalid_password",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  await dbQuery(
    `
      UPDATE haneul_users
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [input.userId, passwordHash],
  );

  if (input.revokeOtherSessions !== false) {
    await revokeOtherUserSessions(input.userId);
  }
}

export async function listCurrentUserSessions(
  userId: string,
): Promise<UserSessionView[]> {
  const currentTokenHash = await getCurrentSessionTokenHash();
  const result = await dbQuery<{
    id: string;
    token_hash: string;
    created_at: Date;
    last_seen_at: Date;
    expires_at: Date;
    user_agent: string | null;
  }>(
    `
      SELECT
        id,
        token_hash,
        created_at,
        last_seen_at,
        expires_at,
        user_agent
      FROM haneul_auth_sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_seen_at DESC, created_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    userAgent: row.user_agent,
    current: Boolean(
      currentTokenHash && row.token_hash === currentTokenHash,
    ),
  }));
}

export async function revokeCurrentUserSession(
  userId: string,
  sessionId: string,
) {
  const currentTokenHash = await getCurrentSessionTokenHash();
  const result = await dbQuery<{ token_hash: string }>(
    `
      DELETE FROM haneul_auth_sessions
      WHERE id = $1 AND user_id = $2
      RETURNING token_hash
    `,
    [sessionId, userId],
  );
  const removed = result.rows[0];

  if (
    removed &&
    currentTokenHash &&
    removed.token_hash === currentTokenHash
  ) {
    await clearSessionCookie();
  }

  return Boolean(removed);
}

export async function revokeOtherUserSessions(userId: string) {
  const currentTokenHash = await getCurrentSessionTokenHash();

  if (!currentTokenHash) {
    throw new AuthError(
      "Không xác định được phiên đăng nhập hiện tại.",
      "invalid_credentials",
    );
  }

  const result = await dbQuery(
    `
      DELETE FROM haneul_auth_sessions
      WHERE user_id = $1 AND token_hash <> $2
    `,
    [userId, currentTokenHash],
  );

  return result.rowCount ?? 0;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Bạn cần đăng nhập.", "invalid_credentials");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError(
      "Tài khoản không có quyền quản trị.",
      "disabled",
    );
  }
  return user;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export async function recordAuditEvent(input: {
  actorUserId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;

  await dbQuery(
    `
      INSERT INTO haneul_audit_events
        (id, actor_user_id, event_type, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      randomUUID(),
      input.actorUserId ?? null,
      input.eventType,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
