import type { LessonContent, StudyQuestion } from "@/data/content";

/**
 * Add deterministic practice for every answerable item already present in an
 * imported lesson. It never changes import jobs, bundles or the saved course.
 * Text-only exercises without a sourced answer remain in the lesson workbook.
 */
const nonEmpty = (value: string | undefined | null) => (value ?? "").trim();

function stableId(lessonId: number, kind: string, index: number, variant = 0) {
  return "source-practice:" + lessonId + ":" + kind + ":" + index + ":" + variant;
}

function optionsFor(
  correct: string,
  alternatives: string[],
  maxOptions = 4,
): string[] {
  const unique = Array.from(new Set([correct, ...alternatives].map(nonEmpty)))
    .filter(Boolean);
  if (unique.length < 2) return [];
  // Stable across remounts: never select arbitrary distractors or shuffle.
  return unique.slice(0, maxOptions);
}

export function buildLessonPracticeBank(
  lesson: LessonContent,
  originalQuestions: StudyQuestion[],
): StudyQuestion[] {
  const original = originalQuestions.filter((q) => q.lessonId === lesson.id);
  const generated: StudyQuestion[] = [];
  const ids = new Set(original.map((q) => q.id));

  function add(item: StudyQuestion) {
    if (!nonEmpty(item.answer) || !nonEmpty(item.prompt) || ids.has(item.id)) return;
    if (item.type === "choice" && (!item.choices?.includes(item.answer) || (item.choices?.length ?? 0) < 2)) return;
    ids.add(item.id);
    generated.push(item);
  }

  const words = lesson.vocabulary ?? [];
  words.forEach((word, index) => {
    const target = nonEmpty(word.targetText || word.ko);
    const meaning = nonEmpty(word.learnerMeaning || word.vi);
    if (!target || !meaning) return;
    const sourceRef = word.sourceRef ?? lesson.sourceRef;
    const meaningOptions = optionsFor(meaning, words.map((w) => w.learnerMeaning || w.vi));
    add({
      id: stableId(lesson.id, "vocab-meaning", index),
      lessonId: lesson.id,
      skill: "vocabulary",
      type: meaningOptions.length ? "choice" : "input",
      title: "Từ vựng " + (index + 1) + "/" + words.length,
      prompt: "Nghĩa của “" + target + "” là gì?",
      choices: meaningOptions.length ? meaningOptions : undefined,
      answer: meaning,
      explanation: target + " — " + meaning,
      sourceRef,
    });
    const targetOptions = optionsFor(target, words.map((w) => w.targetText || w.ko));
    add({
      id: stableId(lesson.id, "vocab-recall", index),
      lessonId: lesson.id,
      skill: "vocabulary",
      type: targetOptions.length ? "choice" : "input",
      title: "Nhớ lại từ " + (index + 1) + "/" + words.length,
      prompt: "Cách viết tương ứng với “" + meaning + "” là gì?",
      choices: targetOptions.length ? targetOptions : undefined,
      answer: target,
      explanation: target + " — " + meaning,
      sourceRef,
    });
    const example = nonEmpty(word.example);
    if (example) add({
      id: stableId(lesson.id, "vocab-example", index),
      lessonId: lesson.id,
      skill: "writing",
      type: "input",
      title: "Chép chính xác câu ví dụ từ vựng",
      prompt: "Đọc câu nguồn rồi gõ lại: " + example,
      answer: example,
      explanation: "Câu ví dụ trong giáo trình: " + example,
      sourceRef,
    });
  });

  const grammar = lesson.grammar ?? [];
  grammar.forEach((item, index) => {
    const pattern = nonEmpty(item.pattern);
    if (pattern && nonEmpty(item.meaning)) add({
      id: stableId(lesson.id, "grammar-pattern", index),
      lessonId: lesson.id,
      skill: "grammar",
      type: "input",
      title: "Nhớ mẫu ngữ pháp " + (index + 1) + "/" + grammar.length,
      prompt: "Viết mẫu ngữ pháp có nghĩa: " + item.meaning,
      answer: pattern,
      explanation: item.explanation || pattern,
      sourceRef: item.sourceRef ?? lesson.sourceRef,
    });
    (item.examples ?? []).forEach((example, exampleIndex) => {
      const sentence = nonEmpty(example);
      if (!sentence) return;
      add({
        id: stableId(lesson.id, "grammar-example-" + index, exampleIndex),
        lessonId: lesson.id,
        skill: "grammar",
        type: "input",
        title: "Luyện chính tả câu mẫu " + (exampleIndex + 1),
        prompt: "Đọc câu mẫu và viết lại chính xác: " + sentence,
        answer: sentence,
        explanation: "Ví dụ nguồn cho " + pattern + ": " + sentence,
        sourceRef: item.sourceRef ?? lesson.sourceRef,
      });
    });
  });

  (lesson.listening ?? []).forEach((item, index) => {
    const answer = nonEmpty(item.answer);
    const choices = Array.from(new Set((item.choices ?? []).map(nonEmpty))).filter(Boolean);
    const usableChoice = choices.length > 1 && choices.includes(answer);
    add({
      id: stableId(lesson.id, "listening", index),
      lessonId: lesson.id,
      skill: "listening",
      type: usableChoice ? "choice" : "input",
      title: "Luyện nghe " + (index + 1),
      prompt: nonEmpty(item.text),
      translation: nonEmpty(item.meaning) || undefined,
      choices: usableChoice ? choices : undefined,
      answer,
      explanation: nonEmpty(item.meaning) || answer,
      sourceRef: item.sourceRef ?? lesson.sourceRef,
    });
  });

  lesson.reading?.questions?.forEach((item, index) => {
    const answer = nonEmpty(item.answer);
    const choices = Array.from(new Set((item.choices ?? []).map(nonEmpty))).filter(Boolean);
    const usableChoice = choices.length > 1 && choices.includes(answer);
    add({
      id: stableId(lesson.id, "reading", index),
      lessonId: lesson.id,
      skill: "reading",
      type: usableChoice ? "choice" : "input",
      title: "Đọc hiểu " + (index + 1),
      prompt: nonEmpty(item.q),
      translation: nonEmpty(lesson.reading?.text) || undefined,
      choices: usableChoice ? choices : undefined,
      answer,
      explanation: "Đáp án trong bài đọc: " + answer,
      sourceRef: item.sourceRef ?? lesson.reading?.sourceRef ?? lesson.sourceRef,
    });
  });

  (lesson.dialogues ?? []).forEach((dialogue, dialogueIndex) => {
    (dialogue.lines ?? []).forEach((line, lineIndex) => {
      const target = nonEmpty(line.targetText || line.ko);
      const meaning = nonEmpty(line.learnerMeaning || line.vi);
      if (!target || !meaning) return;
      add({
        id: stableId(lesson.id, "dialogue-" + dialogueIndex, lineIndex),
        lessonId: lesson.id,
        skill: "speaking",
        type: "input",
        title: "Luyện câu hội thoại " + (lineIndex + 1),
        prompt: (line.speaker ? line.speaker + ": " : "") + meaning + " — Hãy viết câu tiếng Hàn tương ứng.",
        answer: target,
        explanation: target + " — " + meaning,
        sourceRef: dialogue.sourceRef ?? lesson.sourceRef,
      });
    });
  });

  (lesson.speaking ?? []).forEach((text, index) => {
    const sentence = nonEmpty(text);
    if (!sentence) return;
    add({
      id: stableId(lesson.id, "speaking", index),
      lessonId: lesson.id,
      skill: "speaking",
      type: "input",
      title: "Luyện nói và chính tả câu " + (index + 1),
      prompt: "Đọc thành tiếng rồi gõ lại: " + sentence,
      answer: sentence,
      explanation: "Câu gốc: " + sentence,
      sourceRef: lesson.sourceRef,
    });
  });

  (lesson.pronunciation ?? []).forEach((item, index) => {
    (item.examples ?? []).forEach((example, exampleIndex) => {
      const sentence = nonEmpty(example);
      if (!sentence) return;
      add({
        id: stableId(lesson.id, "pronunciation-" + index, exampleIndex),
        lessonId: lesson.id,
        skill: "speaking",
        type: "input",
        title: "Phát âm: " + item.title,
        prompt: "Đọc to, chú ý phát âm, rồi gõ lại: " + sentence,
        answer: sentence,
        explanation: item.explanation || sentence,
        sourceRef: item.sourceRef ?? lesson.sourceRef,
      });
    });
  });

  (lesson.writing?.targetWords ?? []).forEach((word, index) => {
    const target = nonEmpty(word);
    if (!target) return;
    add({
      id: stableId(lesson.id, "writing-word", index),
      lessonId: lesson.id,
      skill: "writing",
      type: "input",
      title: "Luyện từ khóa bài viết " + (index + 1),
      prompt: "Viết lại từ khóa sau, sau đó tự đặt câu: " + target,
      answer: target,
      explanation: "Từ khóa từ nhiệm vụ viết: " + target,
      sourceRef: lesson.writing?.sourceRef ?? lesson.sourceRef,
    });
  });

  // Keep explicit textbook-bank questions first, then append every generated
  // drill. No hidden question cap or corpus-specific hardcoded counts.
  return [...original, ...generated];
}

export function summarizeLessonPractice(lesson: LessonContent, original: StudyQuestion[]) {
  const bank = buildLessonPracticeBank(lesson, original);
  return {
    sourceQuestions: original.filter(q => q.lessonId === lesson.id).length,
    derivedQuestions: bank.length - original.filter(q => q.lessonId === lesson.id).length,
    totalQuestions: bank.length,
    vocabulary: (lesson.vocabulary ?? []).length,
    grammar: (lesson.grammar ?? []).length,
    grammarExamples: (lesson.grammar ?? []).reduce((n, g) => n + (g.examples ?? []).length, 0),
    dialogueLines: (lesson.dialogues ?? []).reduce((n, d) => n + (d.lines ?? []).length, 0),
    listening: (lesson.listening ?? []).length,
    reading: (lesson.reading?.questions ?? []).length,
    speaking: (lesson.speaking ?? []).length,
    pronunciationExamples: (lesson.pronunciation ?? []).reduce((n, p) => n + (p.examples ?? []).length, 0),
    writingPrompts: lesson.writing ? 1 : 0,
    supplementLines: (lesson.extraSections ?? []).reduce((n, e) => n + (e.content ?? []).length, 0),
  };
}
