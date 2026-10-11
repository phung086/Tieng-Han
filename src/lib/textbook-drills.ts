import type { LessonContent } from "@/data/content";

export type DrillMode = "cloze" | "translation" | "dictation";
export type TextbookDrill = {
  id: string;
  mode: DrillMode;
  skill: "vocabulary" | "grammar" | "listening" | "speaking";
  title: string;
  prompt: string;
  answer: string;
  /** Spoken answer: intentionally excluded from the displayed dictation prompt. */
  audioText?: string;
  context?: string;
  hint?: string;
  sourceRef?: string;
};

const clean = (value: string | undefined | null) => (value ?? "").trim();
const key = (lesson: number, kind: string, i: number, j = 0) =>
  ["textbook-drill-v1", lesson, kind, i, j].join(":");

/** Only deterministic answers explicitly available in the imported lesson are graded. */
export function buildTextbookDrills(lesson: LessonContent): TextbookDrill[] {
  const items: TextbookDrill[] = [];
  const seen = new Set<string>();
  const add = (item: TextbookDrill) => {
    if (!clean(item.prompt) || !clean(item.answer) || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };
  const ref = (sourceRef?: string) => sourceRef || lesson.sourceRef;

  (lesson.vocabulary ?? []).forEach((word, i) => {
    const term = clean(word.targetText || word.ko);
    const meaning = clean(word.learnerMeaning || word.vi);
    if (!term || !meaning) return;
    const example = clean(word.example);
    const hasContext = example.includes(term);
    add({
      id: key(lesson.id, "word", i),
      mode: "cloze",
      skill: "vocabulary",
      title: "Điền từ vựng " + (i + 1),
      prompt: hasContext ? example.replace(term, "＿＿＿") : "＿＿＿ = " + meaning,
      answer: term,
      context: hasContext ? "Nghĩa của từ cần điền: " + meaning : undefined,
      hint: "Từ tiếng Hàn có nghĩa: " + meaning,
      sourceRef: ref(word.sourceRef),
    });
    if (example) {
      add({
        id: key(lesson.id, "word-example", i),
        mode: "dictation",
        skill: "vocabulary",
        title: "Nghe câu ví dụ " + (i + 1),
        prompt: "Nghe và viết chính xác câu ví dụ trong giáo trình.",
        answer: example,
        audioText: example,
        hint: "Ví dụ của từ: " + term,
        sourceRef: ref(word.sourceRef),
      });
    }
  });

  (lesson.grammar ?? []).forEach((grammar, i) => {
    // Grammar patterns are sometimes written with a dash indicating a suffix.
    const raw = clean(grammar.pattern);
    const needle = raw.replace(/^[-–—]+/, "").trim();
    (grammar.examples ?? []).forEach((example, j) => {
      const sentence = clean(example);
      if (!sentence) return;
      if (needle && sentence.includes(needle)) {
        add({
          id: key(lesson.id, "grammar-cloze", i, j),
          mode: "cloze",
          skill: "grammar",
          title: "Điền ngữ pháp " + (i + 1) + "." + (j + 1),
          prompt: sentence.replace(needle, "＿＿＿"),
          answer: needle,
          context: "Mẫu: " + raw,
          hint: grammar.meaning + " · " + grammar.explanation,
          sourceRef: ref(grammar.sourceRef),
        });
      }
      add({
        id: key(lesson.id, "grammar-dictation", i, j),
        mode: "dictation",
        skill: "grammar",
        title: "Nghe câu ngữ pháp " + (i + 1) + "." + (j + 1),
        prompt: "Nghe và chép lại câu ngữ pháp mẫu.",
        answer: sentence,
        audioText: sentence,
        hint: "Mẫu: " + raw + " · " + grammar.meaning,
        sourceRef: ref(grammar.sourceRef),
      });
    });
  });

  (lesson.dialogues ?? []).forEach((dialogue, i) => {
    (dialogue.lines ?? []).forEach((line, j) => {
      const korean = clean(line.targetText || line.ko);
      const vietnamese = clean(line.learnerMeaning || line.vi);
      if (korean && vietnamese) {
        add({
          id: key(lesson.id, "dialogue-translation", i, j),
          mode: "translation",
          skill: "speaking",
          title: (dialogue.title || "Hội thoại") + " · " + (line.speaker || j + 1),
          prompt: vietnamese,
          answer: korean,
          context: "Viết lại câu tiếng Hàn theo bản gốc giáo trình.",
          hint: "Đối chiếu nguyên văn với câu trong sách; không chấm ngữ nghĩa các cách diễn đạt khác.",
          sourceRef: ref(dialogue.sourceRef),
        });
      }
      if (korean) {
        add({
          id: key(lesson.id, "dialogue-dictation", i, j),
          mode: "dictation",
          skill: "speaking",
          title: "Nghe hội thoại " + (i + 1) + "." + (j + 1),
          prompt: "Nghe và chép lời của " + (line.speaker || "nhân vật " + (j + 1)) + ".",
          answer: korean,
          audioText: korean,
          hint: vietnamese || "Đọc lại đoạn hội thoại trong bài.",
          sourceRef: ref(dialogue.sourceRef),
        });
      }
    });
  });

  (lesson.listening ?? []).forEach((item, i) => {
    const text = clean(item.text);
    if (!text) return;
    add({
      id: key(lesson.id, "listening-dictation", i),
      mode: "dictation",
      skill: "listening",
      title: "Nghe chép bài " + (i + 1),
      prompt: "Nghe bài và chép lại nội dung.",
      answer: text,
      audioText: text,
      hint: clean(item.meaning) || "Luyện nghe nhiều lượt trước khi kiểm tra.",
      sourceRef: ref(item.sourceRef),
    });
  });
  (lesson.speaking ?? []).forEach((text, i) => {
    const sentence = clean(text);
    if (!sentence) return;
    add({
      id: key(lesson.id, "speaking-dictation", i),
      mode: "dictation",
      skill: "speaking",
      title: "Nghe và viết câu nói " + (i + 1),
      prompt: "Nghe câu luyện nói và chép lại.",
      answer: sentence,
      audioText: sentence,
      sourceRef: lesson.sourceRef,
    });
  });

  return items;
}

/** Strict source-text comparison, not a semantic translation grader. */
export function matchesSourceAnswer(response: string, answer: string): boolean {
  const normalize = (value: string) =>
    value.normalize("NFC").trim().replace(/[.!?。！？]+$/gu, "").replace(/\s+/gu, " ");
  return normalize(response) === normalize(answer);
}

export function countDrillModes(items: TextbookDrill[]) {
  return {
    cloze: items.filter(item => item.mode === "cloze").length,
    translation: items.filter(item => item.mode === "translation").length,
    dictation: items.filter(item => item.mode === "dictation").length,
  };
}
