import { dbQuery } from "@/lib/db";

export async function getLearningState(
  userId: string,
  courseId: string,
) {
  const result = await dbQuery<{ state: unknown; revision: string }>(
    `
      SELECT state, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision
      FROM haneul_learning_states
      WHERE user_id = $1 AND course_id = $2
      LIMIT 1
    `,
    [userId, courseId],
  );

  return result.rows[0] ?? { state: null, revision: null };
}

export async function saveLearningState(input: {
  userId: string;
  courseId: string;
  state: unknown;
  expectedUpdatedAt?: string | null;
}) {
  const serialized = JSON.stringify(input.state);

  const result = await dbQuery<{ revision: string }>(
    `
      WITH saved AS (INSERT INTO haneul_learning_states
        (user_id, course_id, state, updated_at)
      SELECT $1, $2, $3::jsonb, clock_timestamp()
      WHERE $4::boolean = FALSE OR $5::timestamptz IS NULL OR EXISTS (
        SELECT 1 FROM haneul_learning_states
        WHERE user_id = $1 AND course_id = $2 AND (updated_at = $5::timestamptz OR state = $3::jsonb)
      )
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = CASE WHEN haneul_learning_states.state = EXCLUDED.state THEN haneul_learning_states.updated_at ELSE clock_timestamp() END
      WHERE $4::boolean = FALSE
        OR haneul_learning_states.updated_at = $5::timestamptz
        OR haneul_learning_states.state = EXCLUDED.state
      RETURNING updated_at), enrolled AS (
        INSERT INTO haneul_course_enrollments (user_id, course_id, enrolled_at, last_opened_at)
        SELECT $1, $2, NOW(), NOW() FROM saved
        ON CONFLICT (user_id, course_id) DO UPDATE SET last_opened_at = NOW()
        RETURNING user_id
      )
      SELECT to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision FROM saved
    `,
    [input.userId, input.courseId, serialized, input.expectedUpdatedAt !== undefined, input.expectedUpdatedAt ?? null],
  );

  if (!result.rowCount) return null;

  return result.rows[0].revision;
}
