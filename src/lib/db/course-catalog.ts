import { dbQuery, getDbPool } from "@/lib/db";
import type { AuthUser, UserRole } from "@/lib/auth/types";

export type CoursePublicationStatus =
  | "draft"
  | "published"
  | "archived";

export type CourseCatalogRow = {
  course_id: string;
  title: string;
  level: string;
  status: CoursePublicationStatus;
  metadata: Record<string, unknown>;
  updated_at: Date;
  published_at: Date | null;
};

type CourseMetadataInput = {
  id: string;
  title: string;
  level: string;
  source?: unknown;
};

export async function syncCourseCatalog(
  courses: CourseMetadataInput[],
) {
  if (!courses.length) return;

  const client = await getDbPool().connect();
  try {
    await client.query("BEGIN");

    const existingCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM haneul_course_catalog",
    );
    const bootstrapLibrary =
      Number(existingCount.rows[0]?.count ?? 0) === 0;
    const initialStatus: CoursePublicationStatus = bootstrapLibrary
      ? "published"
      : "draft";

    for (const course of courses) {
      await client.query(
        `
          INSERT INTO haneul_course_catalog
            (course_id, title, level, status, metadata, published_at)
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            CASE WHEN $4 = 'published' THEN NOW() ELSE NULL END
          )
          ON CONFLICT (course_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            level = EXCLUDED.level,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `,
        [
          course.id,
          course.title,
          course.level,
          initialStatus,
          JSON.stringify({ source: course.source ?? null }),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCourseStatusMap(courseIds: string[]) {
  if (!courseIds.length) {
    return new Map<string, CoursePublicationStatus>();
  }

  const result = await dbQuery<{
    course_id: string;
    status: CoursePublicationStatus;
  }>(
    `
      SELECT course_id, status
      FROM haneul_course_catalog
      WHERE course_id = ANY($1::text[])
    `,
    [courseIds],
  );

  return new Map(
    result.rows.map((row) => [row.course_id, row.status]),
  );
}

export async function setCourseStatus(
  courseId: string,
  status: CoursePublicationStatus,
) {
  const result = await dbQuery<CourseCatalogRow>(
    `
      UPDATE haneul_course_catalog
      SET
        status = $2,
        updated_at = NOW(),
        published_at = CASE
          WHEN $2 = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END
      WHERE course_id = $1
      RETURNING *
    `,
    [courseId, status],
  );

  return result.rows[0] ?? null;
}

export async function getAdminCourseCatalog() {
  const result = await dbQuery<CourseCatalogRow>(
    `
      SELECT
        course_id,
        title,
        level,
        status,
        metadata,
        updated_at,
        published_at
      FROM haneul_course_catalog
      ORDER BY updated_at DESC
    `,
  );

  return result.rows;
}

export type AdminUserRow = AuthUser & {
  status: "active" | "disabled";
  createdAt: Date;
  lastLoginAt: Date | null;
};

export async function getAdminUsers(limit = 30) {
  const result = await dbQuery<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: "active" | "disabled";
    created_at: Date;
    last_login_at: Date | null;
  }>(
    `
      SELECT
        id,
        email,
        name,
        role,
        status,
        created_at,
        last_login_at
      FROM haneul_users
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

export async function getAdminOverview() {
  const result = await dbQuery<{
    users: string;
    learners: string;
    admins: string;
    active_sessions: string;
    enrollments: string;
    saved_states: string;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM haneul_users)::text AS users,
        (SELECT COUNT(*) FROM haneul_users WHERE role = 'learner')::text AS learners,
        (SELECT COUNT(*) FROM haneul_users WHERE role = 'admin')::text AS admins,
        (
          SELECT COUNT(*)
          FROM haneul_auth_sessions
          WHERE expires_at > NOW()
        )::text AS active_sessions,
        (SELECT COUNT(*) FROM haneul_course_enrollments)::text AS enrollments,
        (SELECT COUNT(*) FROM haneul_learning_states)::text AS saved_states
    `,
  );

  const row = result.rows[0];

  return {
    users: Number(row.users),
    learners: Number(row.learners),
    admins: Number(row.admins),
    activeSessions: Number(row.active_sessions),
    enrollments: Number(row.enrollments),
    savedStates: Number(row.saved_states),
  };
}

export async function setUserRole(
  userId: string,
  role: UserRole,
) {
  if (role === "learner") {
    const admins = await dbQuery<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM haneul_users WHERE role = 'admin' AND status = 'active'",
    );
    const target = await dbQuery<{ role: UserRole }>(
      "SELECT role FROM haneul_users WHERE id = $1",
      [userId],
    );

    if (
      target.rows[0]?.role === "admin" &&
      Number(admins.rows[0]?.count ?? 0) <= 1
    ) {
      throw new Error("Không thể hạ quyền admin cuối cùng.");
    }
  }

  const result = await dbQuery<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
  }>(
    `
      UPDATE haneul_users
      SET role = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role
    `,
    [userId, role],
  );

  return result.rows[0] ?? null;
}


export async function setUserStatus(
  userId: string,
  status: "active" | "disabled",
) {
  const target = await dbQuery<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: "active" | "disabled";
  }>(
    `
      SELECT id, email, name, role, status
      FROM haneul_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  const current = target.rows[0];

  if (!current) return null;

  if (
    status === "disabled" &&
    current.status === "active" &&
    current.role === "admin"
  ) {
    const admins = await dbQuery<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM haneul_users
        WHERE role = 'admin' AND status = 'active'
      `,
    );

    if (Number(admins.rows[0]?.count ?? 0) <= 1) {
      throw new Error("Không thể vô hiệu hóa admin cuối cùng.");
    }
  }

  const result = await dbQuery<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: "active" | "disabled";
  }>(
    `
      UPDATE haneul_users
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, role, status
    `,
    [userId, status],
  );

  if (status === "disabled") {
    await dbQuery(
      "DELETE FROM haneul_auth_sessions WHERE user_id = $1",
      [userId],
    );
  }

  return result.rows[0] ?? null;
}

export type AdminAuditEventRow = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export async function getRecentAuditEvents(
  limit = 30,
): Promise<AdminAuditEventRow[]> {
  const result = await dbQuery<{
    id: string;
    actor_user_id: string | null;
    actor_name: string | null;
    event_type: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    `
      SELECT
        a.id,
        a.actor_user_id,
        u.name AS actor_name,
        a.event_type,
        a.entity_type,
        a.entity_id,
        a.metadata,
        a.created_at
      FROM haneul_audit_events a
      LEFT JOIN haneul_users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
