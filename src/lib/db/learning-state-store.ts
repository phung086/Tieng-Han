import { dbQuery } from "@/lib/db";

export async function getLearningState(
  userId: string,
  courseId: string,
) {
  const result = await dbQuery<{ state: unknown }>(
    `
      SELECT state
      FROM haneul_learning_states
      WHERE user_id = $1 AND course_id = $2
      LIMIT 1
    `,
    [userId, courseId],
  );

  return result.rows[0]?.state ?? null;
}

export async function saveLearningState(input: {
  userId: string;
  courseId: string;
  state: unknown;
}) {
  const serialized = JSON.stringify(input.state);

  await dbQuery(
    `
      INSERT INTO haneul_learning_states
        (user_id, course_id, state, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = NOW()
    `,
    [input.userId, input.courseId, serialized],
  );

  await dbQuery(
    `
      INSERT INTO haneul_course_enrollments
        (user_id, course_id, enrolled_at, last_opened_at)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (user_id, course_id)
      DO UPDATE SET last_opened_at = NOW()
    `,
    [input.userId, input.courseId],
  );
}
