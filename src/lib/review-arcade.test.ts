import { describe, expect, it } from "vitest";
import type { LessonContent } from "@/data/content";
import { arcadeChoices, buildArcadeCards, prioritizeArcade } from "./review-arcade";
import { answerPieces, assemblePieces } from "./touch-answer";
import { grammarBlocks } from "./grammar-reader";
import { relatedGrammar } from "./related-grammar";

const grammarFixture = ({
  id: "g1", pattern: "-고", meaning: "và",
  explanation: "Nối hai hành động.\nLưu ý: giữ toàn bộ điều kiện.\n학교에 가고 공부해요.\nĐến trường và học bài.",
  examples: ["학교에 가고 공부해요.", "먹고 쉬어요."],
  sourceRef: "fixture.pdf p.11 · pattern:g1",
  exampleSourceRefs: ["fixture.pdf p.11 · example:g1:0", "fixture.pdf p.11 · example:g1:1"],
} as unknown) as LessonContent["grammar"][number] & { exampleSourceRefs: string[] };

const lesson: LessonContent = {
  id: 8, title: "검토", vi: "Ôn tập", objective: "Ôn nguồn", sourceRef: "fixture.pdf p.10",
  vocabulary: Array.from({ length: 53 }, (_, i) => ({
    id: `v${i}`, ko: `단어${i}`, vi: `nghĩa ${i}`, example: "",
    sourceRef: `fixture.pdf p.10 · vocabulary:${i}`,
  })),
  grammar: [grammarFixture],
  listening: [], speaking: [], reading: null, writing: null,
};

describe("source-backed review games", () => {
  it("exercises every word in both directions and every grammar example, across lessons", () => {
    const second = { ...lesson, id: 19 };
    const cards = buildArcadeCards([lesson, second]);
    expect(cards.filter(item => item.mode === "meaning")).toHaveLength(106);
    expect(cards.filter(item => item.mode === "recall")).toHaveLength(106);
    expect(cards.filter(item => item.mode === "grammar")).toHaveLength(2);
    expect(cards.filter(item => item.mode === "sentence")).toHaveLength(4);
    expect(new Set(cards.map(item => item.id)).size).toBe(cards.length);
    expect(cards.every(item => Boolean(item.sourceRef))).toBe(true);
  });
  it("keeps sentence memory attached to the same content when examples are reordered", () => {
    const before = buildArcadeCards([lesson]).filter(item => item.mode === "sentence");
    const grammar = lesson.grammar[0] as LessonContent["grammar"][number] & { exampleSourceRefs?: string[] };
    const reorderedGrammar = {
      ...grammar,
      examples: [...grammar.examples].reverse(),
      exampleSourceRefs: [...(grammar.exampleSourceRefs ?? [])].reverse(),
    } as typeof grammar & { exampleSourceRefs?: string[] };
    const after = buildArcadeCards([{ ...lesson, grammar: [reorderedGrammar] }]);
    for (const item of before) expect(after.find(card => card.id === item.id)?.answer).toBe(item.answer);
  });
  it("preserves repeated source examples and never borrows a parent source reference", () => {
    const grammar = lesson.grammar[0] as LessonContent["grammar"][number] & { exampleSourceRefs?: string[] };
    const repeated = {
      ...grammar,
      examples: ["같은 예문", "같은 예문", "다른 예문"],
      exampleSourceRefs: ["fixture.pdf p.11 · repeated:0", "fixture.pdf p.11 · repeated:1"],
    };
    const cards = buildArcadeCards([{
      ...lesson,
      sourceRef: "parent-only.pdf p.1",
      vocabulary: [{ ...lesson.vocabulary[0], sourceRef: undefined }],
      grammar: [repeated],
    }]);
    const sentenceCards = cards.filter(item => item.mode === "sentence");
    expect(sentenceCards).toHaveLength(3);
    expect(sentenceCards.map(item => item.answer)).toEqual(["같은 예문", "같은 예문", "다른 예문"]);
    expect(new Set(sentenceCards.map(item => item.id)).size).toBe(3);
    expect(sentenceCards.map(item => item.sourceRef)).toEqual([
      "fixture.pdf p.11 · repeated:0",
      "fixture.pdf p.11 · repeated:1",
      undefined,
    ]);
    expect(cards.find(item => item.mode === "meaning")?.sourceRef).toBeUndefined();
    expect(cards.find(item => item.mode === "grammar")?.sourceRef).toBe("fixture.pdf p.11 · pattern:g1");
  });
  it("does not use another accepted meaning of the same prompt as a wrong choice", () => {
    const cards = buildArcadeCards([{ ...lesson, vocabulary: [
      { id: "a", ko: "눈", vi: "mắt", example: "" },
      { id: "b", ko: "눈", vi: "tuyết", example: "" },
      { id: "c", ko: "집", vi: "nhà", example: "" },
    ] }]);
    const card = cards.find(item => item.mode === "meaning" && item.answer === "mắt")!;
    expect(arcadeChoices(card, cards)).toContain("mắt");
    expect(arcadeChoices(card, cards)).not.toContain("tuyết");
  });
  it("prioritizes due/weak items without silently dropping the rest", () => {
    const cards = buildArcadeCards([lesson]).filter(item => item.mode === "meaning");
    const mastery = { v12: { strength: 20, dueAt: "2026-10-19" }, v22: { strength: 95, dueAt: "2026-10-17" }, v3: { strength: 100, dueAt: "2026-11-01" } };
    const prioritized = prioritizeArcade(cards, mastery, "2026-10-18", false);
    expect(prioritized).toHaveLength(cards.length);
    expect(prioritized.slice(0, 2).map(item => item.knowledgeId)).toEqual(["v12", "v22"]);
    expect(prioritizeArcade(cards, mastery, "2026-10-18", true).map(item => item.knowledgeId)).toEqual(["v12", "v22"]);
  });
});

describe("touch answers and full grammar reading", () => {
  it("can assemble repeated words and single-word Hangul with punctuation exactly", () => {
    for (const answer of ["가요 가요 학교에 가요.", "안녕하세요.", "-(으)ㄹ 때", "학생"]) {
      const { pieces, separator } = answerPieces(answer);
      expect(assemblePieces(pieces, [...pieces].sort((a, b) => a.id - b.id).map(item => item.id), separator)).toBe(answer);
      expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length);
    }
  });
  it("retains every explanation line, caution, translation and example", () => {
    const grammar = lesson.grammar[0];
    const blocks = grammarBlocks(grammar);
    const visible = blocks.flatMap(block => [block.text, block.translation ?? ""]).join("\n");
    for (const line of grammar.explanation.split("\n")) expect(visible).toContain(line);
    for (const example of grammar.examples) expect(visible).toContain(example);
    expect(blocks.find(block => block.text === grammar.examples[0])?.translation).toBe("Đến trường và học bài.");
  });
  it("links exact patterns across books with separate provenance, never guesses a different conjugation", () => {
    const item = { ...lesson.grammar[0], pattern: "V-(으)ㄴ N" };
    const other = { id: "other", title: "Other book", lessons: [{ ...lesson, grammar: [
      { ...item, id: "match", pattern: "-(으)ㄴ", explanation: "Giải thích khác", sourceRef: "other.pdf p.30" },
      { ...item, id: "wrong", pattern: "-(으)ㄹ", sourceRef: "other.pdf p.31" },
    ] }] };
    expect(relatedGrammar(item, "active", [other]).map(match => match.grammar.id)).toEqual(["match"]);
    expect(relatedGrammar(item, "other", [other])).toEqual([]);
  });
});
