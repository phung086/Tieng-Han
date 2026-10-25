import type { LessonContent, StudyQuestion } from "@/data/content";

/**
 * Evidence-based coverage for a compiled lesson.
 * Missing item-level sourceRef or ambiguous shared references never count as verified.
 * This audit measures representation in the current Course Bundle, NOT
 * completeness against the PDF: a source inventory is still required for that.
 */
export type CoverageKind =
  | "vocabulary"
  | "vocabulary-example"
  | "grammar-pattern"
  | "grammar-example"
  | "dialogue-line"
  | "reading-title"
  | "reading-text"
  | "reading-question"
  | "listening"
  | "speaking"
  | "writing"
  | "writing-target-word"
  | "pronunciation-example";

export type CoverageItem = {
  key: string;
  kind: CoverageKind;
  sourceRef?: string;
  coveredBy: string[];
};

export type LessonPracticeCoverage = {
  lessonId: number;
  sourceItems: number;
  verifiedItems: number;
  uncovered: CoverageItem[];
  ambiguous: CoverageItem[];
  items: CoverageItem[];
  complete: boolean;
};

export function auditLessonPracticeCoverage(
  lesson: LessonContent,
  questions: StudyQuestion[],
): LessonPracticeCoverage {
  const inventory: Omit<CoverageItem, "coveredBy">[] = [];
  const add = (key: string, kind: CoverageKind, sourceRef?: string) =>
    inventory.push({ key, kind, sourceRef: sourceRef?.trim() || undefined });

  lesson.vocabulary.forEach((v, i) => {
    add(`vocabulary:${v.id || i}`, "vocabulary", v.sourceRef);
    if (v.example.trim()) {
      add(`vocabulary:${v.id || i}:example`, "vocabulary-example", v.exampleSourceRef);
    }
  });
  lesson.grammar.forEach((g, i) => {
    if (g.pattern.trim()) {
      add(`grammar:${g.id || i}:pattern`, "grammar-pattern", g.patternSourceRef);
    }
    g.examples.forEach((example, j) => {
      if (example.trim()) {
        add(`grammar:${g.id || i}:example:${j}`, "grammar-example", g.exampleSourceRefs?.[j]);
      }
    });
  });
  lesson.dialogues?.forEach((d, i) =>
    d.lines.forEach((line, j) =>
      add(`dialogue:${d.id || i}:line:${j}`, "dialogue-line", line.sourceRef),
    ),
  );
  if (lesson.reading) {
    if (lesson.reading.title.trim()) {
      add("reading:title", "reading-title", lesson.reading.titleSourceRef);
    }
    if (lesson.reading.text.trim()) {
      add("reading:text", "reading-text", lesson.reading.textSourceRef);
    }
    lesson.reading.questions.forEach((q, i) =>
      add(`reading:${q.id || i}`, "reading-question", q.sourceRef),
    );
  }
  lesson.listening.forEach((q, i) =>
    add(`listening:${q.id || i}`, "listening", q.sourceRef),
  );
  lesson.speaking.forEach((_, i) =>
    add(`speaking:${i}`, "speaking", lesson.speakingSourceRefs?.[i]),
  );
  if (lesson.writing?.prompt.trim()) {
    add("writing:prompt", "writing", lesson.writing.promptSourceRef);
  }
  lesson.writing?.targetWords.forEach((word, i) => {
    if (word.trim()) {
      add(`writing:target-word:${i}`, "writing-target-word", lesson.writing?.targetWordSourceRefs?.[i]);
    }
  });
  lesson.pronunciation?.forEach((item, i) =>
    item.examples.forEach((example, j) => {
      if (example.trim()) {
        add(`pronunciation:${item.id || i}:example:${j}`, "pronunciation-example", item.exampleSourceRefs?.[j]);
      }
    }),
  );

  // A parent section ref must never stand in for a nested source item.
  // One ref must identify exactly one item to be used as coverage evidence.
  const counts = new Map<string, number>();
  for (const item of inventory) {
    if (item.sourceRef) counts.set(item.sourceRef, (counts.get(item.sourceRef) ?? 0) + 1);
  }
  const bySource = new Map<string, string[]>();
  for (const q of questions) {
    if (q.lessonId !== lesson.id || !q.sourceRef?.trim()) continue;
    const ref = q.sourceRef.trim();
    bySource.set(ref, [...(bySource.get(ref) ?? []), q.id]);
  }
  const items: CoverageItem[] = inventory.map((item) => ({
    ...item,
    coveredBy: item.sourceRef && counts.get(item.sourceRef) === 1
      ? (bySource.get(item.sourceRef) ?? [])
      : [],
  }));
  const uncovered = items.filter((item) => item.coveredBy.length === 0);
  const ambiguous = uncovered.filter(
    (item) => item.sourceRef && (counts.get(item.sourceRef) ?? 0) > 1,
  );
  return {
    lessonId: lesson.id,
    sourceItems: items.length,
    verifiedItems: items.length - uncovered.length,
    uncovered,
    ambiguous,
    items,
    complete: items.length > 0 && uncovered.length === 0,
  };
}
