import fs from "node:fs/promises";
import path from "node:path";
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
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "migrations");
const pool = new pg.Pool({ connectionString });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS haneul_schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const existing = await pool.query(
      "SELECT checksum FROM haneul_schema_migrations WHERE id = $1",
      [id],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(
          `Migration ${id} changed after it was applied. Create a new migration instead.`,
        );
      }
      console.log(`skip ${id}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO haneul_schema_migrations (id, checksum) VALUES ($1, $2)",
        [id, checksum],
      );
      await client.query("COMMIT");
      console.log(`applied ${id}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Haneul database is up to date.");
} finally {
  await pool.end();
}
