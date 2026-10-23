import { describe, expect, it, vi } from "vitest";
import type { StudyQuestion } from "@/data/content";
import {
  parsePracticeCheckpoint,
  practiceCheckpointKey,
  serializePracticeCheckpoint,
  type PracticeCheckpoint,
} from "@/lib/practice-checkpoint";

const questions: StudyQuestion[] = Array.from({ length: 120 }, (_, index) => ({
  id: "lesson-3-question-" + index,
  lessonId: 3,
  skill: "vocabulary",
  type: "input",
  title: "Ôn từ " + index,
  prompt: "Nghĩa của 단어" + index,
  answer: "nghĩa " + index,
  explanation: "Từ nguồn",
  sourceRef: "p23",
}));

const state: PracticeCheckpoint = {
  index: 77,
  correctCount: 67,
  mistakeIds: ["lesson-3-question-17", "lesson-3-question-55"],
  skillStats: { vocabulary: { correct: 67, total: 77 } },
};

describe("long textbook practice checkpoint", () => {
  it("restores an already graded first turn without requiring another submission", () => {
    const graded:PracticeCheckpoint={index:0,correctCount:1,mistakeIds:[],skillStats:{vocabulary:{correct:1,total:1}},checked:true,answer:"nghĩa 0",tokens:[]};
    expect(parsePracticeCheckpoint(serializePracticeCheckpoint(questions,graded),questions)).toEqual(graded);
    expect(parsePracticeCheckpoint(serializePracticeCheckpoint(questions,{...graded,correctCount:2}),questions)).toBeNull();
    const malformed=JSON.parse(serializePracticeCheckpoint(questions,graded));malformed.tokens=[null];
    expect(parsePracticeCheckpoint(JSON.stringify(malformed),questions)).toBeNull();
  });
  it("round trips item-level progress beyond the 8-question limit", () => {
    const raw = serializePracticeCheckpoint(questions, state);
    expect(parsePracticeCheckpoint(raw, questions)).toEqual(state);
  });

  it("scopes storage by imported course, lesson, mode and skill", () => {
    const a = practiceCheckpointKey("course-a", 3, "guided", "vocabulary");
    expect(a).not.toBe(practiceCheckpointKey("course-b", 3, "guided", "vocabulary"));
    expect(a).not.toBe(practiceCheckpointKey("course-a", 3, "quick", "vocabulary"));
    expect(a).not.toBe(practiceCheckpointKey("course-a", 4, "guided", "vocabulary"));
    expect(a).not.toBe(practiceCheckpointKey("course-a", 3, "guided", "grammar"));
  });

  it("rejects stale progress when new textbook items are imported", () => {
    const raw = serializePracticeCheckpoint(questions, state);
    expect(parsePracticeCheckpoint(raw, [...questions, { ...questions[0], id: "new-word" }])).toBeNull();
    expect(parsePracticeCheckpoint(raw, questions.toReversed())).toBeNull();
    expect(parsePracticeCheckpoint(raw, questions.map((q, i) => i === 0 ? { ...q, answer: "đáp án đã thay đổi" } : q))).toBeNull();
    expect(parsePracticeCheckpoint(raw, [])).toBeNull();
  });

  it("does not accept corrupt or completed session data", () => {
    expect(parsePracticeCheckpoint("{broken", questions)).toBeNull();
    const raw = JSON.parse(serializePracticeCheckpoint(questions, state));
    raw.index = questions.length;
    expect(parsePracticeCheckpoint(JSON.stringify(raw), questions)).toBeNull();
    raw.index = 77;
    raw.mistakeIds = ["non-existent"];
    expect(parsePracticeCheckpoint(JSON.stringify(raw), questions)).toBeNull();
  });

  it("invalidates a checkpoint when reorder tokens or source evidence changes", () => {
    const reorder: StudyQuestion = {
      ...questions[0],
      type: "reorder",
      prompt: "Sắp xếp câu",
      tokens: ["저는", "학생입니다"],
      answer: "저는 학생입니다.",
      sourceRef: "SÁCH SƠ CẤP 1.pdf · p.12 · sentence-1",
    };
    const bank = [reorder, questions[1]];
    const saved = serializePracticeCheckpoint(bank, {
      index: 1,
      correctCount: 1,
      mistakeIds: [],
      skillStats: { vocabulary: { correct: 1, total: 1 } },
    });

    expect(parsePracticeCheckpoint(saved, bank)).not.toBeNull();
    expect(parsePracticeCheckpoint(saved, [
      { ...reorder, tokens: ["저는", "선생님입니다"] },
      bank[1],
    ])).toBeNull();
    expect(parsePracticeCheckpoint(saved, [
      { ...reorder, sourceRef: "SÁCH SƠ CẤP 1.pdf · p.13 · sentence-1" },
      bank[1],
    ])).toBeNull();
    expect(parsePracticeCheckpoint(saved, [
      { ...reorder, skill: "grammar" },
      bank[1],
    ])).toBeNull();
  });

  it("rejects expired checkpoints and impossible accuracy counts", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-09T04:00:00Z"));
      const raw = JSON.parse(serializePracticeCheckpoint(questions, state));
      raw.savedAt = Date.now() - 181 * 24 * 60 * 60 * 1000;
      expect(parsePracticeCheckpoint(JSON.stringify(raw), questions)).toBeNull();
      raw.savedAt = Date.now();
      raw.correctCount = 100;
      expect(parsePracticeCheckpoint(JSON.stringify(raw), questions)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
