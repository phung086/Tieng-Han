#!/usr/bin/env node
// Read-only curriculum audit. Never mutates a published course or import job.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const library = path.join(root, ".haneul", "courses");
const inventoryPath = process.env.HANEUL_SOURCE_INVENTORY || path.join(root, "curriculum", "source-inventory.json");
const issues = [];
const warnings = [];
let inventory = null;
try { inventory = JSON.parse(await readFile(inventoryPath, "utf8")); } catch { warnings.push("No independently verified source inventory; textbook parity cannot be certified."); }
let files = [];
try { files = (await readdir(library)).filter(name => name.endsWith(".json")); }
catch { warnings.push("No local imported course library; audit requires real imported course artifacts."); }
let lessonsChecked = 0;
for (const file of files) {
  let course;
  try { course = JSON.parse(await readFile(path.join(library, file), "utf8")); }
  catch { issues.push(file + ": invalid JSON"); continue; }
  const questions = Array.isArray(course.questions) ? course.questions : [];
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const duplicateIds = new Set();
  for (const question of questions) {
    if (duplicateIds.has(question.id)) issues.push(file + ": duplicate question id " + question.id);
    duplicateIds.add(question.id);
    if (!lessons.some(lesson => lesson.id === question.lessonId)) issues.push(file + ": orphan question " + question.id);
    if (!question.sourceRef) issues.push(file + ": question lacks sourceRef " + question.id);
  }
  for (const lesson of lessons) {
    lessonsChecked++;
    const prefix = file + " lesson " + lesson.id + ": ";
    const lessonQuestions = questions.filter(q => q.lessonId === lesson.id);
    const vocab = Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [];
    const grammar = Array.isArray(lesson.grammar) ? lesson.grammar : [];
    const dialogueLines = (lesson.dialogues || []).reduce((sum, d) => sum + (d.lines || []).length, 0);
    const readingPrompts = lesson.reading?.questions?.length || 0;
    const counts = { vocabulary: vocab.length, grammar: grammar.length, dialogueLines, readingQuestions: readingPrompts, reviewQuestions: lessonQuestions.length };
    if (!lessonQuestions.length && (vocab.length || grammar.length || readingPrompts)) issues.push(prefix + "lesson has content but no review questions");
    for (const item of [...vocab, ...grammar, ...lessonQuestions]) {
      if (!item.sourceRef) issues.push(prefix + "item " + item.id + " lacks sourceRef");
    }
    const expected = inventory?.courses?.[course.id]?.lessons?.[String(lesson.id)];
    if (expected) {
      for (const [name, expectedCount] of Object.entries(expected)) {
        if (!(name in counts)) continue;
        if (counts[name] !== expectedCount) issues.push(prefix + name + " expected " + expectedCount + " got " + counts[name]);
      }
    } else {
      warnings.push(prefix + "no verified source counts; observed " + JSON.stringify(counts));
    }
    // Do not claim vocabulary coverage from total quiz count: mappings must be verified item by item.
    const skills = new Set(lessonQuestions.map(q => q.skill));
    for (const skill of ["vocabulary", "grammar"]) {
      if ((lesson[skill] || []).length && !skills.has(skill)) issues.push(prefix + "missing " + skill + " review");
    }
  }
}
const result = { status: issues.length ? "fail" : warnings.length ? "unverified" : "pass", coursesChecked: files.length, lessonsChecked, issues, warnings };
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 1;
if (process.env.HANEUL_REQUIRE_VERIFIED === "1" && warnings.length) process.exitCode = 1;
