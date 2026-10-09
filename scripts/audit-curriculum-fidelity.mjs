#!/usr/bin/env node
// Fault-tolerant, source-preserving audit. No published course, import, or MCP mutation.
import { readdir, readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const library = process.env.HANEUL_COURSE_LIBRARY || path.join(root, ".haneul", "courses");
const inventoryPath = process.env.HANEUL_SOURCE_INVENTORY || path.join(root, "curriculum", "source-inventory.json");
const reportPath = process.env.HANEUL_AUDIT_REPORT || path.join(root, ".haneul", "reports", "curriculum-fidelity-latest.json");

const issues = [];
const warnings = [];
const backlog = [];
let coursesChecked = 0;
let lessonsChecked = 0;
let lessonsCompared = 0;

const detail = (error) => error instanceof Error ? error.message : String(error);
function record(code, scope, description, severity = "issue", nextAction = "") {
  const message = "[" + code + "] " + scope + ": " + description;
  (severity === "warning" ? warnings : issues).push(message);
  if (nextAction) {
    backlog.push({ code, scope, severity, nextAction });
  }
}
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const array = (value) => Array.isArray(value) ? value : [];
const sourceRef = (value) => typeof value?.sourceRef === "string" && value.sourceRef.trim().length > 0;

let inventory = null;
try {
  inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  if (!object(inventory?.courses)) throw new Error("expected { courses: {...} }");
} catch (error) {
  record("SOURCE_INVENTORY_UNAVAILABLE", inventoryPath, detail(error), "warning",
    "Supply an independently verified, page-by-page source inventory; do not guess textbook counts.");
  inventory = null;
}

let files = [];
try {
  files = (await readdir(library)).filter(name => name.endsWith(".json")).sort();
  if (!files.length) record("COURSE_LIBRARY_EMPTY", library, "no imported course artifacts", "warning",
    "Provision copies of already-imported course JSONs to the audit runner, without modifying import.");
} catch (error) {
  record("COURSE_LIBRARY_UNAVAILABLE", library, detail(error), "warning",
    "Provision read-only course artifacts for audit; continue checking other available sources.");
}

for (const file of files) {
  const scope = path.join(library, file);
  try {
    const course = JSON.parse(await readFile(scope, "utf8"));
    if (!object(course)) {
      record("INVALID_COURSE", file, "root JSON must be an object", "issue", "Repair only the malformed exported audit artifact.");
      continue;
    }
    coursesChecked++;
    const lessons = course.lessons;
    const questions = course.questions;
    if (!Array.isArray(lessons)) record("INVALID_LESSONS", file, "lessons must be an array", "issue", "Check the exported runtime course shape.");
    if (!Array.isArray(questions)) record("INVALID_QUESTIONS", file, "questions must be an array", "issue", "Check the exported runtime course shape.");
    const existingLessons = array(lessons).filter(object);
    const existingQuestions = array(questions).filter(object);
    const lessonIds = new Set(existingLessons.map(lesson => String(lesson.id)));
    const questionIds = new Set();

    for (const question of existingQuestions) {
      if (!question.id) {
        record("QUESTION_ID_MISSING", file, "question missing stable id", "issue", "Restore stable unique question identifiers.");
      } else if (questionIds.has(question.id)) {
        record("DUPLICATE_QUESTION_ID", file, "duplicate " + question.id, "issue", "Deduplicate without dropping independent textbook exercises.");
      }
      questionIds.add(question.id);
      if (!lessonIds.has(String(question.lessonId))) {
        record("ORPHAN_QUESTION", file, String(question.id) + " references missing lesson " + question.lessonId, "issue",
          "Associate this question with an existing sourced lesson.");
      }
      if (!sourceRef(question)) {
        record("QUESTION_NO_SOURCE", file, String(question.id), "issue", "Restore page/section sourceRef for question " + question.id);
      }
    }

    for (const lesson of existingLessons) {
      const label = file + " lesson " + lesson.id;
      try {
        lessonsChecked++;
        const vocab = array(lesson.vocabulary);
        const grammar = array(lesson.grammar);
        const dialogueLines = array(lesson.dialogues).reduce((n, dialogue) =>
          n + (object(dialogue) ? array(dialogue.lines).length : 0), 0);
        const readingQuestions = array(lesson.reading?.questions).length;
        const lessonQuestions = existingQuestions.filter(q => String(q.lessonId) === String(lesson.id));
        const counts = {
          vocabulary: vocab.length,
          grammar: grammar.length,
          dialogueLines,
          readingQuestions,
          reviewQuestions: lessonQuestions.length,
        };
        if (!lessonQuestions.length && (vocab.length || grammar.length || readingQuestions)) {
          record("NO_PRACTICE", label, "source content has no review questions", "issue",
            "Author questions for all evidenced items; retain the original textbook exercise patterns.");
        }
        for (const [category, entries] of [["vocabulary", vocab], ["grammar", grammar]]) {
          if (entries.length && !lessonQuestions.some(q => q.skill === category)) {
            record("MISSING_SKILL_PRACTICE", label, category + " has no practice questions", "issue",
              "Create sourced " + category + " practice with exhaustive item-level mappings.");
          }
          for (const item of entries) {
            if (!sourceRef(item)) {
              record("ITEM_NO_SOURCE", label, category + "/" + String(item?.id || "unknown"), "issue",
                "Repair sourceRef; do not infer the source location.");
            }
          }
        }
        const expected = inventory?.courses?.[course.id]?.lessons?.[String(lesson.id)];
        if (!object(expected)) {
          record("COUNTS_UNVERIFIED", label, JSON.stringify(counts), "warning",
            "Count all original textbook items and subparts for this lesson independently.");
        } else {
          lessonsCompared++;
          for (const [key, expectedCount] of Object.entries(expected)) {
            if (!(key in counts)) continue;
            if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
              record("INVALID_SOURCE_COUNT", label, key + " is not a nonnegative integer", "issue",
                "Correct the independently validated count in source inventory.");
            } else if (counts[key] !== expectedCount) {
              record("COUNT_MISMATCH", label, key + ": expected " + expectedCount + ", got " + counts[key], "issue",
                "Investigate missing/extra source items and preserve exact exercise patterns.");
            }
          }
          if (!("reviewQuestions" in expected)) {
            record("EXERCISE_COUNT_UNVERIFIED", label, "no sourced reviewQuestions count", "warning",
              "Count every textbook exercise and subpart, not only the existing quizzes.");
          }
        }
        // Quantity parity alone cannot certify that each source item is exercised.
        record("ITEM_MAPPING_UNVERIFIED", label, "item-level source-to-practice mappings are not certified by this count audit", "warning",
          "Add a verified sourceItemId + exercise-pattern map and regression fixtures before claiming 100% fidelity.");
      } catch (error) {
        record("LESSON_AUDIT_ERROR", label, detail(error), "issue", "Isolate this lesson and retry in the next cycle.");
      }
    }
  } catch (error) {
    record("COURSE_AUDIT_ERROR", file, detail(error), "issue",
      "Isolate the unreadable exported course; continue auditing the other courses.");
  }
}

const result = {
  generatedAt: new Date().toISOString(),
  status: issues.length ? "fail" : warnings.length ? "unverified" : "pass",
  coursesChecked, lessonsChecked, lessonsCompared,
  issueCount: issues.length, warningCount: warnings.length,
  issues, warnings, backlog,
  continuation: "All independent courses and lessons are attempted. Unresolved tasks remain in backlog for later iterations.",
};
const output = JSON.stringify(result, null, 2) + "\n";
console.log(output);
try {
  await mkdir(path.dirname(reportPath), { recursive: true });
  const temporary = reportPath + "." + randomUUID() + ".tmp";
  await writeFile(temporary, output, "utf8");
  await rename(temporary, reportPath);
} catch (error) {
  console.error("REPORT_WRITE_ERROR " + detail(error));
}
// Keep strict checks available for PR release gates, but never cancel the recurring audit.
if (process.env.HANEUL_AUDIT_NONBLOCKING !== "1") {
  if (issues.length || (process.env.HANEUL_REQUIRE_VERIFIED === "1" && warnings.length)) process.exitCode = 1;
}
