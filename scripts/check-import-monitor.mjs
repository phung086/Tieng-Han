// Disposable local QA user. Never claims, requeues or consumes real import jobs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import pg from "pg";
const base = "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Local database required.");
const fixtureFile = ".haneul/import-monitor-qa.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (process.argv.includes("--cleanup")) {
    const { id } = JSON.parse(await readFile(fixtureFile, "utf8"));
    await pool.query("DELETE FROM haneul_audit_events WHERE actor_user_id = $1", [id]);
    await pool.query("DELETE FROM haneul_users WHERE id = $1 AND email LIKE 'import-monitor-qa-%@example.invalid'", [id]);
    await unlink(fixtureFile);
    console.log("Removed disposable monitor QA account and sessions.");
  } else {
    const email = `import-monitor-qa-${randomUUID()}@example.invalid`;
    const response = await fetch(base + "/api/auth/register", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Import Monitor QA", email, password: "MonitorQa2026!" }) });
    assert.equal(response.status, 201);
    const data = await response.json();
    await writeFile(fixtureFile, JSON.stringify({ id: data.user.id, email }), "utf8");
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.equal((await fetch(base + "/api/import-monitor", { headers: { Cookie: cookie } })).status, 403);
    await pool.query("UPDATE haneul_users SET role = 'admin' WHERE id = $1", [data.user.id]);
    const monitored = await fetch(base + "/api/import-monitor", { headers: { Cookie: cookie } });
    assert.equal(monitored.status, 200);
    const result = await monitored.json();
    assert.equal(monitored.headers.get("cache-control"), "no-store");
    assert.ok(result.connection.endpoint.endsWith("/mcp"));
    assert.ok(result.jobs.length);
    const second = await fetch(base + "/api/import-monitor?jobId=" + result.jobs[1].id, { headers: { Cookie: cookie } });
    assert.equal(second.status, 200);
    assert.equal((await second.json()).job.id, result.jobs[1].id);
    console.log(JSON.stringify({ email, status: result.job.status, pages: result.job.uploadedPages, lessons: result.job.completed.length, checkpointCount: result.job.work.length, activeSubscriptions: result.connection.matchingSubscriptions }));
    console.log("PASS anonymous/learner/admin boundary, real progress snapshots and selecting historical jobs. Fixture retained only for browser QA; run --cleanup afterwards.");
  }
} finally { await pool.end(); }
