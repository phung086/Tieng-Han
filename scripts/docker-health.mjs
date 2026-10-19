import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, max: 1 });
try {
  await pool.query("SELECT 1 FROM haneul_schema_migrations LIMIT 1");
  const response = await fetch("http://127.0.0.1:3000/api/auth/me", { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Backend not ready");
} catch {
  process.exitCode = 1;
} finally { await pool.end(); }
