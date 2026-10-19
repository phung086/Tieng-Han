import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(file); } catch { /* Optional environment file. */ }
}
const base = new URL(process.argv[2] ?? "http://localhost:3000");
const database = new URL(process.env.DATABASE_URL ?? "");
const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (!local.has(base.hostname) || !local.has(database.hostname)) throw new Error("Run this check only against a local app and local database.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const createdUsers = [];

async function request(path, { cookie, method = "GET", body, origin = base.origin, raw } = {}) {
  const response = await fetch(new URL(path, base), {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== "GET" ? { Origin: origin, "Content-Type": "application/json" } : {}) },
    ...(method !== "GET" ? { body: raw ?? JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function register() {
  const response = await request("/api/auth/register", { method: "POST", body: { name: "Temporary integration check", email: `learning-check-${crypto.randomUUID()}@example.invalid`, password: crypto.randomBytes(24).toString("base64url") } });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  createdUsers.push(response.data.user.id);
  assert.ok(response.cookie);
  return { id: response.data.user.id, cookie: response.cookie };
}
function emptyState() {
  return { version: 2, xp: 0, streak: 0, dailyGoal: 50, todayXp: 0, lastActiveDate: null, lessonProgress: {}, completedActivities: [], dailyStats: {}, mastery: {}, skills: Object.fromEntries(["vocabulary", "grammar", "listening", "speaking", "reading", "writing"].map(skill => [skill, { correct: 0, total: 0 }])) };
}
try {
  const library = await request("/api/courses");
  assert.equal(library.status, 200);
  assert.ok(library.data.courses.length >= 2, "Expected the existing two textbooks.");
  const courseId = library.data.courses[0].id;
  const otherCourseId = library.data.courses[1].id;
  const a = await register(); const b = await register();
  const path = "/api/me/learning-state?courseId=" + encodeURIComponent(courseId);
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, { cookie: a.cookie })).data.state, null);
  const state = { ...emptyState(), xp: 10 };
  const body = { courseId, state, expectedUserId: a.id, expectedUpdatedAt: null };
  const first = await request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", body });
  assert.equal(first.status, 200, JSON.stringify(first.data)); assert.ok(first.data.revision);
  const read = await request(path, { cookie: a.cookie });
  assert.equal(read.data.state.xp, 10); assert.equal(read.data.revision, first.data.revision);
  assert.equal((await request(path, { cookie: b.cookie })).data.state, null);
  assert.equal((await request("/api/me/learning-state?courseId=" + encodeURIComponent(otherCourseId), { cookie: a.cookie })).data.state, null);
  console.log("Account and course isolation: passed.");

  const mismatch = await request("/api/me/learning-state", { cookie: b.cookie, method: "PUT", body });
  assert.equal(mismatch.status, 409); assert.equal(mismatch.data.code, "account_changed");
  const writes = await Promise.all([20, 30].map(xp => request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", body: { ...body, state: { ...state, xp }, expectedUpdatedAt: first.data.revision } })));
  assert.deepEqual(writes.map(result => result.status).sort(), [200, 409]);
  const latest = await request(path, { cookie: a.cookie });
  assert.ok([20, 30].includes(latest.data.state.xp));
  const stale = await request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", body: { ...body, expectedUpdatedAt: first.data.revision } });
  assert.equal(stale.status, 409); assert.equal(stale.data.code, "progress_conflict");
  assert.equal((await request(path, { cookie: a.cookie })).data.state.xp, latest.data.state.xp);
  console.log("Concurrent writes and stale snapshots: passed.");

  const invalid = emptyState(); invalid.skills.grammar.correct = 10;
  assert.equal((await request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", body: { ...body, state: invalid } })).status, 400);
  assert.equal((await request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", raw: "{broken" })).status, 400);
  assert.equal((await request("/api/me/learning-state", { cookie: a.cookie, method: "PUT", body, origin: "https://example.invalid" })).status, 403);
  const active = await request("/api/course", { cookie: a.cookie });
  assert.equal(active.status, 200); assert.ok(library.data.courses.some(course => course.id === active.data.course.id));
  const enrolled = await pool.query("SELECT count(*)::int AS count FROM haneul_course_enrollments WHERE user_id=$1 AND course_id=$2", [a.id, courseId]);
  assert.equal(enrolled.rows[0].count, 1);
  console.log("Input validation, origin checks and enrollment: passed.");
  const logout = await request("/api/auth/logout", { cookie: a.cookie, method: "POST", body: {} });
  assert.equal(logout.status, 200); assert.equal((await request(path, { cookie: a.cookie })).status, 401);
  console.log("Session invalidation: passed.");
} finally {
  for (const id of createdUsers) {
    await pool.query("DELETE FROM haneul_audit_events WHERE actor_user_id=$1", [id]);
    await pool.query("DELETE FROM haneul_users WHERE id=$1", [id]);
  }
  await pool.end();
  console.log("Temporary integration accounts removed.");
}
