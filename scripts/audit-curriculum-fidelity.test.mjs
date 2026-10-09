import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./audit-curriculum-fidelity.mjs", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "haneul-fidelity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const library = path.join(root, "courses");
  const report = path.join(root, "report.json");
  await mkdir(library);
  return { root, library, report };
}

function audit({ root, library, report }, overrides = {}) {
  const run = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      HANEUL_COURSE_LIBRARY: library,
      HANEUL_AUDIT_REPORT: report,
      HANEUL_AUDIT_NONBLOCKING: "1",
      HANEUL_REQUIRE_VERIFIED: "0",
      ...overrides,
    },
  });
  assert.equal(run.signal, null, run.stderr);
  return run;
}

test("missing source inventory is reported as unverified, not a successful match", async (t) => {
  const context = await fixture(t);
  const run = audit(context);
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.status, "unverified");
  assert.equal(result.coursesChecked, 0);
  assert.ok(result.backlog.some(item => item.code === "SOURCE_INVENTORY_UNAVAILABLE"));
  assert.ok(result.backlog.some(item => item.code === "COURSE_LIBRARY_EMPTY"));
});

test("one malformed course cannot prevent checking a separate valid course", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.library, "a-broken.json"), "{ invalid");
  await writeFile(path.join(context.library, "b-valid.json"), JSON.stringify({
    id: "course-sample",
    lessons: [{
      id: 1, vocabulary: [{ id: "v1", ko: "안녕", vi: "xin chào", sourceRef: "p2" }],
      grammar: [], dialogues: [], reading: null,
    }],
    questions: [{
      id: "q1", lessonId: 1, skill: "vocabulary", type: "choice",
      answer: "xin chào", prompt: "안녕", sourceRef: "p2",
    }],
  }));
  const inventory = path.join(context.root, "inventory.json");
  await writeFile(inventory, JSON.stringify({ courses: {
    "course-sample": { lessons: { "1": {
      vocabulary: 1, grammar: 0, dialogueLines: 0, readingQuestions: 0, reviewQuestions: 2,
    } } },
  } }));
  const run = audit(context, { HANEUL_SOURCE_INVENTORY: inventory });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.coursesChecked, 1);
  assert.equal(result.lessonsChecked, 1);
  assert.equal(result.lessonsCompared, 1);
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some(issue => issue.includes("COURSE_AUDIT_ERROR") && issue.includes("a-broken")));
  assert.ok(result.issues.some(issue => issue.includes("COUNT_MISMATCH") && issue.includes("reviewQuestions")));
  assert.ok(result.backlog.some(item => item.code === "COUNT_MISMATCH"));
});

test("strict release gate fails on source gaps but still persists its report", async (t) => {
  const context = await fixture(t);
  const run = audit(context, {
    HANEUL_AUDIT_NONBLOCKING: "0",
    HANEUL_REQUIRE_VERIFIED: "1",
  });
  assert.equal(run.status, 1);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.status, "unverified");
  assert.ok(result.warningCount > 0);
});
