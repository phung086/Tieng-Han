import crypto from "node:crypto";
import process from "node:process";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Optional local env file.
  }
}

const connectionString = process.env.DATABASE_URL;
const email = process.argv[2]?.trim().toLowerCase();

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!email) {
  console.error("Usage: pnpm db:promote-admin user@example.com");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });

try {
  const result = await pool.query(
    `
      UPDATE haneul_users
      SET role = 'admin', updated_at = NOW()
      WHERE email = $1
      RETURNING id, email, name, role
    `,
    [email],
  );

  if (!result.rowCount) {
    console.error(`No Haneul user found for ${email}.`);
    process.exitCode = 1;
  } else {
    const user = result.rows[0];
    await pool.query(
      `
        INSERT INTO haneul_audit_events
          (id, actor_user_id, event_type, entity_type, entity_id, metadata)
        VALUES ($1, $2, 'user.promoted_admin', 'user', $2, $3::jsonb)
      `,
      [
        crypto.randomUUID(),
        user.id,
        JSON.stringify({ email: user.email, source: "cli" }),
      ],
    );
    console.log(`${user.email} is now an admin.`);
  }
} finally {
  await pool.end();
}
