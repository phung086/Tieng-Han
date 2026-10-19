// Disposable accounts and synthetic exercise data only. Does not call a paid model.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.HANEUL_TEST_URL || "http://localhost:3000";
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (!localHosts.has(new URL(base).hostname) || !localHosts.has(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Run only against a local test app and database.");
const users = [];
const jobs = [];
const connections = [];
let rpcId = 0;
async function api(path, cookie, body, method = "POST") {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { response, data: await response.json() };
}
async function register() {
  const { response, data } = await api("/api/auth/register", null, { name: "Worksheet QA", email: `worksheet-qa-${randomUUID()}@example.invalid`, password: randomBytes(18).toString("hex") });
  assert.equal(response.status, 201);
  users.push(data.user.id);
  return response.headers.get("set-cookie").split(";")[0];
}
async function rpc(method, params, modern = true) {
  // MCP 2 requests must carry the envelope as well as matching HTTP headers.
  const _meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": { name: "haneul-worksheet-qa", version: "1.0.0" }, "io.modelcontextprotocol/clientCapabilities": {} };
  const response = await fetch(base + "/worksheet-mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(modern ? { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method, ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}) } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params: modern ? { ...params, _meta } : params }) });
  const text = await response.text();
  assert.equal(response.status, 200, text.slice(0, 200));
  const payload = text.startsWith("data:") || text.includes("\ndata:") ? JSON.parse(text.split("\n").find((line) => line.startsWith("data:")).slice(5)) : JSON.parse(text);
  assert.equal(payload.error, undefined, JSON.stringify(payload.error));
  return payload.result;
}

try {
  const alice = await register(), bob = await register();
  connections.push(alice, bob);
  assert.equal((await api("/api/worksheets/jobs", null, {})).response.status, 401);
  assert.equal((await api("/api/worksheets/automation", null, undefined, "GET")).response.status, 401);
  const channel = await api("/api/worksheets/automation", alice, {});
  assert.equal(channel.response.status, 200);
  assert.equal(channel.data.channelKey.length, 43);
  assert.equal((await api("/api/worksheets/automation", bob, undefined, "GET")).data.configured, false);
  const discover = await rpc("server/discover", {});
  assert.deepEqual(discover.supportedVersions, ["2026-07-28"]);
  assert.deepEqual(discover.capabilities.events, {});
  assert.equal((await rpc("events/list", {})).events[0].name, "worksheet_job.queued");
  const question = { id: "q1", page: 1, question: "저(은, 는) 학생입니다.", instruction: "Chọn tiểu từ đúng.", warning: "" };
  assert.equal((await api("/api/worksheets/jobs", alice, { action: "solve", questions: [question], automatic: true })).response.status, 409);
  const created = await api("/api/worksheets/jobs", alice, { action: "solve", questions: [question] });
  assert.equal(created.response.status, 200);
  const job = created.data;
  jobs.push({ id: job.id, cookie: alice });
  assert.equal((await api(`/api/worksheets/jobs/${job.id}`, bob, undefined, "GET")).response.status, 404);
  const tools = await rpc("tools/list", {});
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["read_worksheet", "submit_worksheet"]);
  assert.equal(tools.resultType, "complete");
  assert.equal((await rpc("tools/list", {}, false)).tools.length, 2);
  const denied = await rpc("tools/call", { name: "read_worksheet", arguments: { jobId: job.id, accessKey: "x".repeat(43) } });
  assert.equal(denied.isError, true);
  const read = await rpc("tools/call", { name: "read_worksheet", arguments: { jobId: job.id, accessKey: job.accessKey } });
  const source = JSON.parse(read.content[0].text);
  assert.equal(source.questions[0].question, question.question);
  const saved = await rpc("tools/call", { name: "submit_worksheet", arguments: { jobId: job.id, accessKey: job.accessKey, sourceDigest: source.sourceDigest, items: [{ ...question, answer: "저는 학생입니다.", translation: "Tôi là học sinh." }] } });
  assert.notEqual(saved.isError, true, JSON.stringify(saved));
  const polled = await api(`/api/worksheets/jobs/${job.id}`, alice, undefined, "GET");
  assert.equal(polled.data.status, "ready");
  assert.equal(polled.data.items[0].answer, "저는 학생입니다.");
  assert.deepEqual(polled.data.activity.map((event) => event.kind), ["created", "read", "submitted"]);
  assert.equal(JSON.stringify(polled.data.activity).includes(job.accessKey), false);
  assert.equal(JSON.stringify(polled.data.activity).includes(question.question), false);
  assert.ok(polled.data.createdAt > 0);
  assert.equal((await api(`/api/worksheets/jobs/${job.id}/dispatch`, bob, { accessKey: job.accessKey })).response.status, 400);
  assert.equal((await api(`/api/worksheets/jobs/${job.id}/dispatch`, alice, { accessKey: job.accessKey })).data.state, "ready");
  assert.equal((await api(`/api/worksheets/jobs/${job.id}`, alice, {}, "DELETE")).response.status, 200);
  assert.equal((await api(`/api/worksheets/jobs/${job.id}`, alice, undefined, "GET")).response.status, 404);
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a18sAAAAASUVORK5CYII=";
  const imageJob = (await api("/api/worksheets/jobs", alice, { action: "extract", pages: [{ page: 1, image: pixel }, { page: 2, image: pixel }] })).data;
  jobs.push({ id: imageJob.id, cookie: alice });
  const imageSource = await rpc("tools/call", { name: "read_worksheet", arguments: { jobId: imageJob.id, accessKey: imageJob.accessKey } });
  assert.equal(JSON.parse(imageSource.content[0].text).pages.length, 2);
  assert.equal(imageSource.content.some((entry) => entry.type === "image"), false);
  for (const page of [1, 2]) {
    const pageRead = await rpc("tools/call", { name: "read_worksheet", arguments: { jobId: imageJob.id, accessKey: imageJob.accessKey, page } });
    assert.equal(pageRead.content[1].type, "image");
    assert.equal(pageRead.content[1].mimeType, "image/png");
  }
  const imageStatus = (await api(`/api/worksheets/jobs/${imageJob.id}`, alice, undefined, "GET")).data;
  assert.deepEqual(imageStatus.sourcePages, [1, 2]);
  assert.deepEqual(imageStatus.activity.filter((event) => event.kind === "read" && event.page).map((event) => event.page), [1, 2]);
  const deniedDigest = await rpc("tools/call", { name: "submit_worksheet", arguments: { jobId: imageJob.id, accessKey: imageJob.accessKey, sourceDigest: "x".repeat(64), items: [{ ...question, answer: "", translation: "", warning: "Ảnh kiểm thử không chứa câu đề." }] } });
  assert.equal(deniedDigest.isError, true);
  assert.equal((await api(`/api/worksheets/jobs/${imageJob.id}`, alice, undefined, "GET")).data.activity.at(-1).kind, "result_rejected");
  console.log("PASS worksheet HTTP/MCP: auth, owner isolation, channel setup, event discovery, unconfigured guard, capability, source digest, submit, polling, dispatch isolation, deletion");
} finally {
  for (const cookie of connections) await api("/api/worksheets/automation", cookie, {}, "DELETE").catch(() => {});
  for (const job of jobs) await api(`/api/worksheets/jobs/${job.id}`, job.cookie, {}, "DELETE").catch(() => {});
  if (users.length) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query("DELETE FROM haneul_audit_events WHERE actor_user_id = ANY($1::text[])", [users]);
      await pool.query("DELETE FROM haneul_users WHERE id = ANY($1::text[])", [users]);
    }
    finally { await pool.end(); }
  }
}
