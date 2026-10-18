import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseCourseBundle } from "@/lib/course-bundle";
import { buildArcadeCards } from "@/lib/review-arcade";
import { grammarBlocks } from "@/lib/grammar-reader";

// Opt in to private local exports. No textbook or learner data is committed.
const library = process.env.HANEUL_REGRESSION_LIBRARY;
describe.skipIf(!library)("read-only regression against existing imported courses", () => {
  it("validates every existing lesson and question without losing collection items", async () => {
    const files = (await readdir(library!)).filter(name => name.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      try {
        const course = JSON.parse(await readFile(path.join(library!, file), "utf8"));
        const parsed = parseCourseBundle(JSON.stringify({ format: "haneul-course-bundle", version: 1, course }));
        expect(parsed.course.lessons.length).toBe(course.lessons.length);
        expect(parsed.course.questions.length).toBe(course.questions.length);
        for (let index = 0; index < course.lessons.length; index++) {
          for (const key of ["vocabulary", "grammar", "listening", "speaking", "dialogues", "pronunciation", "culture", "extraSections"] as const) {
            expect(parsed.course.lessons[index][key]?.length ?? 0).toBe(course.lessons[index][key]?.length ?? 0);
          }
          const lesson = parsed.course.lessons[index];
          const games = buildArcadeCards([lesson]);
          for (const word of lesson.vocabulary.filter(item => (item.targetText || item.ko).trim() && (item.learnerMeaning || item.vi).trim())) {
            expect(games.filter(item => item.knowledgeId === word.id)).toHaveLength(2);
          }
          for (const grammar of lesson.grammar) {
            const blocks = grammarBlocks(grammar);
            const visible = blocks.flatMap(item => [item.text, item.translation ?? ""]).join("\n");
            for (const line of grammar.explanation.split(/\r?\n/).filter(item => item.trim())) expect(visible).toContain(line.trim());
            for (const example of grammar.examples.filter(item => item.trim())) {
              expect(visible).toContain(example.trim());
              expect(games.some(item => item.mode === "sentence" && item.answer === example.trim())).toBe(true);
            }
          }
        }
      } catch (error) {
        failures.push(file + ": " + (error instanceof Error ? error.message : String(error)));
      }
    }
    expect(failures).toEqual([]);
  });
});
