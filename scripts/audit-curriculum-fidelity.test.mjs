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
  assert.ok(result.issues.some(issue => issue.includes("MISSING_SOURCE_COUNT") && issue.includes("vocabularyExamples")));
});

test("omitted supported dimensions fail even when declared counts match", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.library, "course.json"), JSON.stringify({
    id: "course-partial-inventory",
    lessons: [{ id: 1, vocabulary: [], grammar: [], dialogues: [], reading: null }],
    questions: [],
  }));
  const inventory = path.join(context.root, "inventory.json");
  // A partial inventory can match its one declared count while omitting every
  // other dimension. Those omissions must block certification, not imply zero.
  await writeFile(inventory, JSON.stringify({ courses: {
    "course-partial-inventory": { lessons: { "1": { vocabulary: 0 } } },
  } }));
  const run = audit(context, { HANEUL_SOURCE_INVENTORY: inventory });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.lessonsCompared, 1);
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some(issue => issue.includes("MISSING_SOURCE_COUNT") && issue.includes("grammar")));
  assert.ok(result.issues.some(issue => issue.includes("MISSING_SOURCE_COUNT") && issue.includes("reviewQuestions")));
});

test("extended source dimensions are compared against the inventory", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.library, "course.json"), JSON.stringify({
    id: "course-rich",
    lessons: [{
      id: 1,
      vocabulary: [{ id: "v1", ko: "학교", example: "학교에 가요", sourceRef: "p1" }],
      grammar: [{ id: "g1", pattern: "-에", examples: ["학교에", "집에"], sourceRef: "p1" }],
      dialogues: [{ id: "d1", lines: [{ ko: "안녕하세요" }] }],
      listening: [{ id: "l1", text: "듣기", choices: ["A", "B"] }],
      reading: { title: "읽기", text: "본문", questions: [{ id: "r1", q: "?", choices: ["A", "B", "C"] }] },
      speaking: ["말하기"],
      writing: { prompt: "쓰기", targetWords: ["학교", "집"] },
      pronunciation: [{ id: "p1", title: "발음", examples: ["학교", "집"] }],
      culture: [{ id: "c1", title: "문화", text: "한국" }],
      extraSections: [{ id: "e1", title: "연습", content: ["하나", "둘"] }],
      media: [{ id: "m1" }],
      illustrations: [{ id: "i1" }],
    }],
    questions: [
      { id: "qv", lessonId: 1, skill: "vocabulary", type: "choice", origin: "source", prompt: "단어", choices: ["A", "B"], answer: "A", sourceRef: "p1" },
      { id: "qg", lessonId: 1, skill: "grammar", type: "choice", origin: "derived", prompt: "문법", choices: ["A", "B"], answer: "B", sourceRef: "p1" },
      { id: "ql", lessonId: 1, skill: "listening", type: "choice", origin: "source", prompt: "듣기", choices: ["A", "B"], answer: "A", sourceRef: "p1" },
    ],
  }));
  const inventory = path.join(context.root, "inventory.json");
  await writeFile(inventory, JSON.stringify({ courses: {
    "course-rich": { lessons: { "1": {
      vocabulary: 1, vocabularyExamples: 1, grammar: 1, grammarExamples: 2,
      dialogueLines: 1, listeningItems: 1, listeningChoices: 2,
      readingTitles: 1, readingPassages: 1, readingQuestions: 1, readingQuestionChoices: 3,
      speakingPrompts: 1, writingPrompts: 1, writingTargetWords: 2,
      pronunciationItems: 1, pronunciationTitles: 1, pronunciationExamples: 2,
      cultureItems: 1, cultureTitles: 1, cultureTexts: 1,
      extraSections: 1, extraSectionItems: 2, mediaItems: 1, illustrations: 1,
      reviewQuestions: 2, reviewQuestionChoices: 4, reviewQuestionAnswers: 2,
    } } },
  } }));
  const run = audit(context, { HANEUL_SOURCE_INVENTORY: inventory });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.lessonsCompared, 1);
  assert.ok(!result.issues.some(issue => issue.includes("COUNT_MISMATCH")));
  assert.ok(!result.issues.some(issue => issue.includes("UNSUPPORTED_SOURCE_COUNT")));
});

test("unknown inventory dimensions fail closed instead of being silently skipped", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.library, "course.json"), JSON.stringify({
    id: "course-unknown",
    lessons: [{ id: 1, vocabulary: [], grammar: [], dialogues: [], reading: null }],
    questions: [],
  }));
  const inventory = path.join(context.root, "inventory.json");
  await writeFile(inventory, JSON.stringify({ courses: {
    "course-unknown": { lessons: { "1": { workbookSubparts: 3 } } },
  } }));
  const run = audit(context, { HANEUL_SOURCE_INVENTORY: inventory });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some(issue => issue.includes("UNSUPPORTED_SOURCE_COUNT") && issue.includes("workbookSubparts")));
  assert.ok(result.backlog.some(item => item.code === "UNSUPPORTED_SOURCE_COUNT"));
});

test("inventory lessons and courses without compiled destinations fail closed", async (t) => {
  const context = await fixture(t);
  await writeFile(path.join(context.library, "course.json"), JSON.stringify({
    id: "course-inventory-parity",
    lessons: [{ id: 1, vocabulary: [], grammar: [], dialogues: [], reading: null }],
    questions: [],
  }));
  const inventory = path.join(context.root, "inventory.json");
  const dimensions = [
    "vocabulary", "vocabularyExamples", "grammar", "grammarExamples", "dialogueLines",
    "listeningItems", "listeningChoices", "readingTitles", "readingPassages",
    "readingQuestions", "readingQuestionChoices", "speakingPrompts", "writingPrompts",
    "writingTargetWords", "pronunciationItems", "pronunciationTitles",
    "pronunciationExamples", "cultureItems", "cultureTitles", "cultureTexts",
    "extraSections", "extraSectionItems", "mediaItems", "illustrations",
    "reviewQuestions", "reviewQuestionChoices", "reviewQuestionAnswers",
  ];
  const zeroCounts = Object.fromEntries(dimensions.map((key) => [key, 0]));
  await writeFile(inventory, JSON.stringify({ courses: {
    "course-inventory-parity": { lessons: { "1": zeroCounts, "2": zeroCounts } },
    "source-only-course": { lessons: { "1": zeroCounts } },
    "malformed-course": {},
  } }));
  const run = audit(context, { HANEUL_SOURCE_INVENTORY: inventory });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(await readFile(context.report, "utf8"));
  assert.equal(result.status, "fail");
  assert.ok(result.issues.some((issue) =>
    issue.includes("SOURCE_LESSON_MISSING") && issue.includes("course-inventory-parity lesson 2")));
  assert.ok(result.issues.some((issue) =>
    issue.includes("SOURCE_COURSE_MISSING") && issue.includes("source-only-course")));
  assert.ok(result.issues.some((issue) =>
    issue.includes("INVALID_SOURCE_INVENTORY_COURSE") && issue.includes("malformed-course")));
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
