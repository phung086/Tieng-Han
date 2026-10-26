import type { LessonContent, SourceExerciseMotif, StudyQuestion } from "@/data/content";
import { normalizeReorderAnswer } from "@/lib/answer-check";

export type WorkbookCategory =
  | "Từ vựng" | "Ngữ pháp" | "Nghe" | "Nói" | "Đọc" | "Viết"
  | "Hội thoại" | "Phát âm" | "Văn hóa" | "Bài tập bổ sung" | "Câu hỏi đã nhập"
  | "Bài tập gốc" | "Phụ lục gốc"
  | "Nguồn dự phòng · chưa tính là bài biên soạn";

export type WorkbookItem = {
  id: string;
  category: WorkbookCategory;
  title: string;
  prompt: string;
  hint?: string;
  answer?: string;
  choices?: string[];
  /** Original source exercise motif; absent on legacy/untyped items. */
  exerciseType?: SourceExerciseMotif;
  /** Source-provided reorder tokens or matching columns; never generated from guesses. */
  tokens?: string[];
  leftItems?: string[];
  rightItems?: string[];
  sourceRef?: string;
};

const value = (v: string | undefined | null) => (v ?? "").trim();
// Compare canonically equivalent Unicode labels without rewriting source text.
const comparisonKey = (v: string | undefined | null) => value(v).normalize("NFC");

// Match StudySession's answer normalization and ensure the answer can be formed
// from the declared source token chunks. Unused chunks remain valid distractors.
function canConstructReorderAnswer(tokens: string[] | undefined, answer: string | undefined): boolean {
  const normalize = normalizeReorderAnswer;
  const target = normalize(value(answer));
  const chunks = (tokens ?? []).map(token => normalize(value(token)));
  if (!target || !chunks.length || chunks.some(chunk => !chunk)) return false;

  const used = chunks.map(() => false);
  const failed = new Set<string>();
  function search(position: number): boolean {
    while (target[position] === " ") position++;
    if (position >= target.length) return true;

    const key = position + "|" + used.map((isUsed, index) => isUsed ? index : "").join(",");
    if (failed.has(key)) return false;
    failed.add(key);

    for (let index = 0; index < chunks.length; index++) {
      if (used[index]) continue;
      const chunk = chunks[index];
      const end = position + chunk.length;
      if (!target.startsWith(chunk, position) || (end < target.length && target[end] !== " ")) continue;

      used[index] = true;
      if (search(end)) return true;
      used[index] = false;
    }
    return false;
  }

  return search(0);
}

export function buildSourceWorkbook(
  lesson: LessonContent,
  questions: StudyQuestion[],
): WorkbookItem[] {
  const items: WorkbookItem[] = [];
  function add(item: WorkbookItem) {
    if (value(item.prompt)) items.push(item);
  }
  const id = (kind: string, index: number, sub = 0) =>
    "source:" + lesson.id + ":" + kind + ":" + index + ":" + sub;

  lesson.vocabulary.forEach((word, index) => {
    const term = value(word.targetText || word.ko);
    const meaning = value(word.learnerMeaning || word.vi);
    add({
      id: id("vocabulary", index), category: "Từ vựng", title: "Từ " + (index + 1),
      prompt: term, hint: "Đọc, phát âm và nhớ nghĩa trước khi mở đáp án.",
      answer: meaning || undefined,
      sourceRef: word.sourceRef,
    });
    if (value(word.example)) add({
      id: id("vocab-example", index), category: "Từ vựng", title: "Câu ví dụ " + (index + 1),
      prompt: word.example, hint: "Đọc thành tiếng và đặt một câu tương tự.",
      sourceRef: word.exampleSourceRef,
    });
  });

  lesson.grammar.forEach((item, index) => {
    add({
      id: id("grammar", index), category: "Ngữ pháp", title: "Mẫu ngữ pháp " + (index + 1),
      prompt: item.pattern, hint: item.explanation, answer: item.meaning,
      sourceRef: item.sourceRef,
    });
    item.examples.forEach((example, sub) => add({
      id: id("grammar-example-" + index, sub), category: "Ngữ pháp",
      title: "Câu mẫu " + (index + 1) + "." + (sub + 1),
      prompt: example, hint: "Đọc mẫu, ghi lại cấu trúc và tạo câu khác theo mẫu.",
      sourceRef: item.exampleSourceRefs?.[sub],
    }));
  });

  lesson.listening.forEach((item, index) => add({
    id: id("listening", index), category: "Nghe", title: "Bài nghe " + (index + 1),
    prompt: item.text, hint: item.meaning,
    choices: item.choices, answer: item.answer,
    sourceRef: item.sourceRef,
  }));

  lesson.speaking.forEach((text, index) => add({
    id: id("speaking", index), category: "Nói", title: "Lượt nói " + (index + 1),
    prompt: text, hint: "Đọc to, thu âm hoặc shadowing theo câu nguồn.",
    sourceRef: lesson.speakingSourceRefs?.[index],
  }));

  if (lesson.reading) {
    add({
      id: id("reading-passage", 0), category: "Đọc",
      title: lesson.reading.title || "Bài đọc",
      prompt: lesson.reading.text, answer: lesson.reading.translation,
      hint: "Đọc hiểu toàn văn trước khi mở bản dịch.",
      sourceRef: lesson.reading.sourceRef,
    });
    lesson.reading.questions.forEach((question, index) => add({
      id: id("reading-question", index), category: "Đọc",
      title: "Đọc hiểu " + (index + 1), prompt: question.q,
      choices: question.choices, answer: question.answer,
      sourceRef: question.sourceRef,
    }));
  }

  if (lesson.writing) {
    add({
      id: id("writing", 0), category: "Viết",
      title: "Nhiệm vụ viết",
      prompt: lesson.writing.prompt,
      hint: [lesson.writing.hint, ...lesson.writing.targetWords].filter(Boolean).join(" · "),
      sourceRef: lesson.writing.sourceRef,
    });
    lesson.writing.targetWords.forEach((word, index) => add({
      id: id("writing-target-word", index), category: "Viết",
      title: "Từ mục tiêu viết " + (index + 1),
      prompt: word,
      hint: "Từ mục tiêu của nhiệm vụ viết; sử dụng trong bài viết.",
      sourceRef: lesson.writing?.targetWordSourceRefs?.[index],
    }));
  }

  (lesson.dialogues ?? []).forEach((dialogue, index) => {
    dialogue.lines.forEach((line, sub) => add({
      id: id("dialogue-" + index, sub), category: "Hội thoại",
      title: (dialogue.title || "Hội thoại " + (index + 1)) + " · " + (line.speaker || "Lượt " + (sub + 1)),
      prompt: value(line.targetText || line.ko),
      answer: value(line.learnerMeaning || line.vi) || undefined,
      hint: "Đọc theo vai rồi tự viết lại câu không nhìn sách.",
      sourceRef: line.sourceRef,
    }));
  });

  (lesson.pronunciation ?? []).forEach((item, index) => {
    add({
      id: id("pronunciation", index), category: "Phát âm",
      title: item.title, prompt: item.explanation,
      hint: "Quan sát quy tắc phát âm trước khi luyện ví dụ.",
      sourceRef: item.sourceRef,
    });
    item.examples.forEach((example, sub) => add({
      id: id("pronunciation-example-" + index, sub), category: "Phát âm",
      title: item.title + " · Ví dụ " + (sub + 1),
      prompt: example,
      hint: "Luyện đọc chuẩn phát âm.",
      sourceRef: item.exampleSourceRefs?.[sub],
    }));
  });

  (lesson.culture ?? []).forEach((item, index) => add({
    id: id("culture", index), category: "Văn hóa",
    title: item.title, prompt: item.text,
    hint: "Đọc và ghi lại thông tin văn hóa đáng nhớ.",
    sourceRef: item.sourceRef,
  }));

  (lesson.extraSections ?? []).forEach((section, index) => {
    const sourceCategories: Record<string, WorkbookCategory> = {
      "source-transcript": "Nguồn dự phòng · chưa tính là bài biên soạn",
      "original-activities": "Bài tập gốc",
      "original-appendix": "Phụ lục gốc",
      "original-speaking": "Nói",
      "original-listening": "Nghe",
      "original-reading": "Đọc",
      "original-writing": "Viết",
      "original-pronunciation": "Phát âm",
      "original-culture": "Văn hóa",
    };
    section.content.forEach((text, sub) => {
      const activity = section.contentExerciseItems?.find(item => item.contentIndex === sub);
      const choices = activity?.type === "choice" ? activity.choices : undefined;
      const normalizedChoices = (choices ?? []).map(comparisonKey);
      const choiceAnswerIsSafe = Boolean(
        choices && choices.length >= 2 &&
        normalizedChoices.every(Boolean) &&
        new Set(normalizedChoices).size === normalizedChoices.length &&
        activity?.answer && normalizedChoices.includes(comparisonKey(activity.answer)),
      );
      const matchingPairs = activity?.type === "matching" ? activity.answerPairs ?? [] : [];
      const leftValues = (activity?.leftItems ?? []).map(comparisonKey);
      const rightValues = (activity?.rightItems ?? []).map(comparisonKey);
      const pairLeftValues = matchingPairs.map(pair => comparisonKey(pair.left));
      const pairRightValues = matchingPairs.map(pair => comparisonKey(pair.right));
      // A source key is safe to reveal only when it maps every left entry once
      // to a distinct declared right entry. Ambiguous string-based labels stay manual.
      const matchingAnswerIsSafe = Boolean(
        matchingPairs.length > 0 &&
        leftValues.length > 0 &&
        rightValues.length > 0 &&
        leftValues.every(Boolean) &&
        rightValues.every(Boolean) &&
        new Set(leftValues).size === leftValues.length &&
        new Set(rightValues).size === rightValues.length &&
        matchingPairs.length === leftValues.length &&
        new Set(pairLeftValues).size === matchingPairs.length &&
        new Set(pairRightValues).size === matchingPairs.length &&
        matchingPairs.every((pair, index) =>
          pairLeftValues[index] && pairRightValues[index] &&
          leftValues.includes(pairLeftValues[index]) &&
          rightValues.includes(pairRightValues[index]),
        ),
      );
      const answer = activity?.type === "choice"
        ? (choiceAnswerIsSafe ? activity.answer : undefined)
        : activity?.type === "matching"
          ? (matchingAnswerIsSafe ? matchingPairs.map(pair => pair.left + " → " + pair.right).join("\n") : undefined)
          : activity?.type === "reorder"
            ? (canConstructReorderAnswer(activity.tokens, activity.answer) ? activity.answer : undefined)
            : activity?.answer;
      add({
        id: id("extra-" + index, sub),
        category: sourceCategories[section.kind] ?? "Bài tập bổ sung",
        title: section.title + " · " + (sub + 1),
        prompt: text,
        hint: [section.kind, activity?.hint, "Giữ nguyên lời bài tập nguồn; tự làm hoặc đối chiếu đáp án trong sách."].filter(Boolean).join(" · "),
        choices,
        exerciseType: activity?.type,
        tokens: activity?.type === "reorder" ? activity.tokens : undefined,
        leftItems: activity?.type === "matching" ? activity.leftItems : undefined,
        rightItems: activity?.type === "matching" ? activity.rightItems : undefined,
        answer,
        sourceRef: section.contentSourceRefs?.[sub],
      });
    });
  });

  questions.filter(q => q.lessonId === lesson.id).forEach((question, index) => add({
    id: id("imported-question", index), category: "Câu hỏi đã nhập",
    title: question.title, prompt: question.prompt,
    hint: question.translation,
    choices: question.choices ?? question.tokens,
    answer: question.answer,
    sourceRef: question.sourceRef,
  }));

  return items;
}