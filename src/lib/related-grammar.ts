import type { GrammarItem, LessonContent } from "@/data/content";

// Only typography and explicit part-of-speech placeholders are normalized.
// Different conjugations/compound patterns are deliberately not guessed equivalent.
function patternKey(pattern: string) {
  return pattern.normalize("NFC").trim().replace(/^[NAV](?:\/[NAV])?[-\s]+/, "").replace(/\s+N$/, "").replace(/^[-–—]+/, "").replace(/\s+/g, "");
}

export function relatedGrammar(item: GrammarItem, activeCourseId: string, courses: { id: string; title: string; lessons: LessonContent[] }[]) {
  const key = patternKey(item.pattern);
  if (!key) return [];
  return courses.filter(course => course.id !== activeCourseId).flatMap(course =>
    course.lessons.flatMap(lesson => lesson.grammar.filter(grammar =>
      Boolean(grammar.sourceRef) && patternKey(grammar.pattern) === key && grammar.explanation.trim() !== item.explanation.trim(),
    ).map(grammar => ({ courseId: course.id, courseTitle: course.title, lessonId: lesson.id, grammar }))),
  );
}
