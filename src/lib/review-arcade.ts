import type { LessonContent } from "@/data/content";

export type ArcadeMode = "meaning" | "recall" | "grammar" | "sentence";
export type ArcadeCard = {
  id: string;
  knowledgeId: string;
  lessonId: number;
  skill: "vocabulary" | "grammar";
  mode: ArcadeMode;
  prompt: string;
  answer: string;
  note: string;
  sourceRef?: string;
};
export type RecallState = Record<string, { strength: number; dueAt: string }>;
const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return (value >>> 0).toString(36);
};

/** New game formats, using only existing terms, explanations and examples. No textbook cap. */
export function buildArcadeCards(lessons: LessonContent[]): ArcadeCard[] {
  return lessons.flatMap(lesson => {
    const cards: ArcadeCard[] = [];
    for (const word of lesson.vocabulary) {
      const term = (word.targetText || word.ko).trim();
      const meaning = (word.learnerMeaning || word.vi).trim();
      if (!term || !meaning) continue;
      for (const mode of ["meaning", "recall"] as const) cards.push({
        id: `arcade:${lesson.id}:${word.id}:${mode}`,
        knowledgeId: word.id, lessonId: lesson.id, skill: "vocabulary", mode,
        prompt: mode === "meaning" ? term : meaning,
        answer: mode === "meaning" ? meaning : term,
        note: word.example || `${term} · ${meaning}`,
        sourceRef: word.sourceRef,
      });
    }
    for (const grammar of lesson.grammar) {
      const knowledgeId = `grammar:${lesson.id}:${grammar.id}`;
      if (grammar.pattern.trim() && grammar.meaning.trim()) cards.push({
        id: `arcade:${lesson.id}:${grammar.id}:grammar`, knowledgeId,
        lessonId: lesson.id, skill: "grammar", mode: "grammar",
        prompt: grammar.pattern, answer: grammar.meaning,
        note: grammar.explanation, sourceRef: grammar.sourceRef,
      });
      const grammarWithExampleRefs = grammar as typeof grammar & { exampleSourceRefs?: string[] };
      const occurrences = new Map<string, number>();
      grammar.examples.forEach((sentence, index) => {
        const identity = sentence.trim();
        if (!identity) return;
        const sourceRef = grammarWithExampleRefs.exampleSourceRefs?.[index]?.trim();
        // Prefer the exact source-item anchor so repeated identical examples keep their
        // review identity when source order changes. Text + occurrence is a fallback only.
        const identityKey = sourceRef ? `ref:${sourceRef}` : `text:${identity}`;
        const occurrence = occurrences.get(identityKey) ?? 0;
        occurrences.set(identityKey, occurrence + 1);
        const identityHash = hash(identityKey);
        cards.push({
          id: `arcade:${lesson.id}:${grammar.id}:sentence:${identityHash}:${occurrence}`,
          knowledgeId: `${knowledgeId}:example:${identityHash}:${occurrence}`,
          lessonId: lesson.id, skill: "grammar", mode: "sentence",
          prompt: `Xếp câu ví dụ của mẫu ${grammar.pattern}`,
          answer: sentence, note: grammar.meaning,
          sourceRef: sourceRef || undefined,
        });
      });
    }
    return cards;
  });
}

export function arcadeChoices(card: ArcadeCard, bank: ArcadeCard[]): string[] {
  const answersForPrompt = new Set(bank.filter(item => item.mode === card.mode && item.prompt === card.prompt).map(item => item.answer));
  const distractors = [...new Set(bank.filter(item => item.mode === card.mode && !answersForPrompt.has(item.answer)).map(item => item.answer))];
  // A small answer palette is a game UI, not a limit on the deck's coverage.
  const start = distractors.length ? parseInt(hash(card.id), 36) % distractors.length : 0;
  const choices = [card.answer, ...distractors.slice(start), ...distractors.slice(0, start)].slice(0, 4);
  const position = parseInt(hash(card.id + ":position"), 36) % choices.length;
  choices.splice(position, 0, choices.shift()!);
  return choices;
}

export function prioritizeArcade(cards: ArcadeCard[], mastery: RecallState, today: string, dueOnly: boolean) {
  const result = dueOnly ? cards.filter(card => {
    const recall = mastery[card.knowledgeId];
    return recall && (recall.dueAt <= today || recall.strength < 60);
  }) : [...cards];
  const priority = (card: ArcadeCard) => {
    const recall = mastery[card.knowledgeId];
    return !recall ? 1 : recall.dueAt <= today || recall.strength < 60 ? 0 : 2;
  };
  return result.sort((a, b) => priority(a) - priority(b) ||
    (mastery[a.knowledgeId]?.strength ?? 35) - (mastery[b.knowledgeId]?.strength ?? 35));
}
