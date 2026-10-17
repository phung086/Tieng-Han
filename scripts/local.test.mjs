import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { inspectLibrary, parseOptions, sourceFingerprint, compareRuntimeLibrary } from "./local.mjs";

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "haneul-local-"));
  try { await run(root); }
  finally {
    if (path.dirname(path.resolve(root)) !== path.resolve(tmpdir()) || !path.basename(root).startsWith("haneul-local-")) throw new Error("Unsafe test fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
}
const lesson = (id, count) => ({ id, vocabulary: [], grammar: Array.from({ length: count }, (_, index) => ({ id: "g" + index, pattern: "synthetic pattern", explanation: "synthetic explanation", examples: ["example A", "example B"] })) });

test("audits every lesson and grammar example beyond small quiz-sized limits", () => fixture(async root => {
  await mkdir(path.join(root, "courses"));
  const course = { id: "synthetic", title: "Synthetic only", lessons: Array.from({ length: 60 }, (_, index) => lesson(index + 1, index + 1)), questions: [] };
  await writeFile(path.join(root, "courses", "synthetic.json"), JSON.stringify(course));
  const audit = await inspectLibrary(root);
  assert.equal(audit.lessons, 60);
  assert.equal(audit.grammar, 1830);
  assert.equal(audit.courses[0].examples, 3660);
  assert.deepEqual(audit.courses[0].lessonsWithoutGrammar, []);
}));

test("does not silently skip broken courses, duplicate lessons or malformed grammar", () => fixture(async root => {
  await mkdir(path.join(root, "courses"));
  const file = path.join(root, "courses", "bad.json");
  await writeFile(file, "broken JSON");
  await assert.rejects(inspectLibrary(root));
  await writeFile(file, JSON.stringify({ id: "synthetic", lessons: [lesson(1, 1), lesson(1, 1)], questions: [] }));
  await assert.rejects(inspectLibrary(root), /trùng ID/);
  await writeFile(file, JSON.stringify({ id: "synthetic", lessons: [{ ...lesson(1, 1), grammar: [{ pattern: "test", explanation: "test", examples: null }] }], questions: [] }));
  await assert.rejects(inspectLibrary(root), /Ngữ pháp không hợp lệ/);
}));

test("keeps no-grammar lessons visible instead of fabricating grammar", () => fixture(async root => {
  await mkdir(path.join(root, "courses"));
  await writeFile(path.join(root, "courses", "synthetic.json"), JSON.stringify({ id: "synthetic", lessons: [lesson(1, 0), lesson(2, 1)], questions: [] }));
  assert.deepEqual((await inspectLibrary(root)).courses[0].lessonsWithoutGrammar, [1]);
}));

test("compares the entire runtime payload, including grammar near the end of a long course", () => fixture(async root => {
  await mkdir(path.join(root, "courses"));
  const course = { id: "synthetic", title: "Synthetic", lessons: Array.from({ length: 60 }, (_, index) => lesson(index + 1, 2)), questions: [], extension: { preserve: true } };
  await writeFile(path.join(root, "courses", "synthetic.json"), JSON.stringify(course));
  const expected = await inspectLibrary(root);
  assert.equal(compareRuntimeLibrary(expected, [course]).complete, true);
  const changed = structuredClone(course); changed.lessons[59].grammar[1].examples.pop();
  assert.deepEqual(compareRuntimeLibrary(expected, [changed]).changed, ["synthetic"]);
  assert.deepEqual(compareRuntimeLibrary(expected, []).missing, ["synthetic"]);
  assert.equal(compareRuntimeLibrary(expected, [course, course]).complete, false);
}));

test("fingerprints new and changed source files without private data affecting a build", () => fixture(async root => {
  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, ".haneul"));
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(path.join(root, "src", "app.ts"), "initial");
  const initial = await sourceFingerprint(root);
  await writeFile(path.join(root, ".haneul", "private.json"), "private runtime content");
  assert.equal(await sourceFingerprint(root), initial);
  await writeFile(path.join(root, "src", "new-file.ts"), "new uncommitted source");
  const added = await sourceFingerprint(root);
  assert.notEqual(added, initial);
  await writeFile(path.join(root, "src", "app.ts"), "changed");
  assert.notEqual(await sourceFingerprint(root), added);
}));

test("rejects ambiguous arguments and invalid ports", () => {
  assert.equal(parseOptions(["--data-dir", "runtime books", "--port", "3007", "--check"]).dataDir, "runtime books");
  assert.equal(parseOptions(["--rebuild"]).rebuild, true);
  for (const args of [["--port", "0"], ["--port", "70000"], ["--port", "abc"], ["--unknown"], ["--data-dir"], ["--data-dir", "--check"]]) assert.throws(() => parseOptions(args));
});
