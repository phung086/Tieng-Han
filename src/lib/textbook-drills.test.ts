import { describe, expect, it } from "vitest";
import type { LessonContent } from "@/data/content";
import {
  buildTextbookDrills,
  countDrillModes,
  matchesSourceAnswer,
} from "@/lib/textbook-drills";

function makeLesson(wordCount: number): LessonContent {
  return {
    id: 7,
    title: "제7과",
    vi: "Bài 7",
    objective: "Luyện tập theo nguồn",
    sourceRef: "Sơ cấp 1 p.50",
    vocabulary: Array.from({ length: wordCount }, (_, i) => ({
      id: "word-" + i,
      ko: "단어" + i,
      vi: "nghĩa " + i,
      example: "저는 단어" + i + " 좋아합니다.",
      sourceRef: "Sơ cấp 1 p.51",
    })),
    grammar: [
      {
        id: "grammar-1",
        pattern: "-입니다",
        meaning: "là",
        explanation: "Lối nói trang trọng",
        examples: ["저는 학생입니다.", "여기는 학교입니다."],
        sourceRef: "Sơ cấp 1 p.52",
      },
      {
        id: "grammar-2",
        pattern: "-(으)ㄹ까요?",
        meaning: "rủ rê",
        explanation: "Mẫu biến hình không trùng nguyên văn",
        examples: ["같이 갈까요?"],
        sourceRef: "Sơ cấp 1 p.53",
      },
    ],
    listening: [
      {
        id: "listen-1",
        text: "안녕하세요.",
        meaning: "Xin chào",
        choices: ["안녕하세요.", "감사합니다."],
        answer: "안녕하세요.",
        sourceRef: "Sơ cấp 1 p.54",
      },
    ],
    speaking: ["감사합니다.", "만나서 반갑습니다."],
    reading: null,
    writing: null,
    dialogues: [
      {
        id: "dialogue-1",
        sourceRef: "Sơ cấp 1 p.55",
        title: "대화",
        lines: [
          { speaker: "민수", ko: "안녕하세요.", vi: "Xin chào." },
          { speaker: "영희", ko: "저는 학생입니다.", vi: "Tôi là học sinh." },
          { speaker: "민수", ko: "반갑습니다.", vi: "" },
        ],
      },
    ],
  };
}

describe("real exercises from imported lesson content", () => {
  it("builds each vocabulary cloze and example dictation without a cap", () => {
    const drills = buildTextbookDrills(makeLesson(81));
    const words = drills.filter(item => item.id.includes(":word:"));
    const examples = drills.filter(item => item.id.includes(":word-example:"));
    expect(words).toHaveLength(81);
    expect(examples).toHaveLength(81);
    expect(words[80].answer).toBe("단어80");
    expect(words[80].prompt).toBe("저는 ＿＿＿ 좋아합니다.");
    expect(words[80].sourceRef).toBe("Sơ cấp 1 p.51");
    expect(examples[80].prompt).not.toContain(examples[80].answer);
    expect(examples[80].audioText).toBe(examples[80].answer);
    expect(new Set(drills.map(item => item.id)).size).toBe(drills.length);
  });

  it("creates grammar cloze only when the pattern is literally present", () => {
    const drills = buildTextbookDrills(makeLesson(3));
    const grammarCloze = drills.filter(item => item.id.includes("grammar-cloze"));
    expect(grammarCloze).toHaveLength(2);
    expect(grammarCloze.every(item => item.answer === "입니다")).toBe(true);
    expect(grammarCloze[0].prompt).toBe("저는 학생＿＿＿.");
    expect(drills.filter(item => item.id.includes("grammar-dictation"))).toHaveLength(3);
    expect(drills.some(item => item.mode === "cloze" && item.prompt.includes("갈까요"))).toBe(false);
  });

  it("does not invent answers when a bilingual dialogue translation is missing", () => {
    const drills = buildTextbookDrills(makeLesson(2));
    const translation = drills.filter(item => item.mode === "translation");
    expect(translation).toHaveLength(2);
    expect(translation.map(item => item.answer)).toEqual(["안녕하세요.", "저는 학생입니다."]);
    expect(drills.filter(item => item.id.includes("dialogue-dictation"))).toHaveLength(3);
    expect(translation[1].sourceRef).toBe("Sơ cấp 1 p.55");
    const count = countDrillModes(drills);
    expect(count.cloze + count.translation + count.dictation).toBe(drills.length);
  });
  it("distinguishes source turns, added translations and added dialogue practice without claiming an unreviewed book original", () => {
    const lesson = makeLesson(0);
    const translation = () => buildTextbookDrills(lesson).find(item=>item.mode === "translation")!;
    expect(translation().context).toContain("xuất xứ chưa được xác nhận");
    lesson.dialogues![0].origin = "derived";
    expect(translation().context).toContain("biên soạn bổ trợ");
    expect(translation().context).not.toContain("trong giáo trình");
    lesson.dialogues![0].origin = "source";
    lesson.dialogues![0].translationOrigin = "derived";
    expect(translation().context).toContain("Mẫu hội thoại trong giáo trình");
    expect(translation().context).toContain("Bản dịch Việt bổ trợ");
  });

  it("falls back to a sourced meaning prompt where an example cannot be clozed", () => {
    const lesson = makeLesson(1);
    lesson.vocabulary[0].example = "교실에 가요.";
    const drills = buildTextbookDrills(lesson);
    const word = drills.find(item => item.id.includes(":word:0:"));
    expect(word?.prompt).toBe("＿＿＿ = nghĩa 0");
    expect(word?.answer).toBe("단어0");
  });

  it("compares exact sourced wording without pretending semantic translation grading", () => {
    expect(matchesSourceAnswer("  저는 학생입니다! ", "저는 학생입니다.")).toBe(true);
    expect(matchesSourceAnswer("저는  학생입니다", "저는 학생입니다")).toBe(true);
    expect(matchesSourceAnswer("저는 선생님입니다", "저는 학생입니다")).toBe(false);
  });

  it("handles source fields that are empty without throwing or generating false answers", () => {
    const lesson = makeLesson(0);
    lesson.dialogues = [{ id: "dialogue", lines: [{ speaker: "A", ko: "", vi: "No translation" }] }];
    lesson.grammar = [];
    lesson.listening = [];
    lesson.speaking = [];
    expect(buildTextbookDrills(lesson)).toEqual([]);
  });
});
