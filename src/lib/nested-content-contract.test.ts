import { describe, expect, it } from "vitest";
import { validateNestedContent } from "@/lib/nested-content-contract";

function validLesson() {
  return {
    vocabulary: [],
    grammar: [],
    listening: [
      {
        id: "listen-1",
        text: "안녕하세요?",
        meaning: "Xin chào?",
        choices: ["Xin chào", "Tạm biệt"],
        answer: "Xin chào",
      },
    ],
    speaking: [],
    reading: {
      title: "자기소개",
      text: "저는 학생입니다.",
      translation: "Tôi là học sinh.",
      questions: [
        {
          id: "read-1",
          q: "저는 누구입니까?",
          choices: ["학생", "회사원"],
          answer: "학생",
        },
      ],
    },
    writing: { prompt: "Viết một câu.", hint: "", targetWords: [] },
  };
}

describe("nested lesson multiple-choice integrity", () => {
  it("accepts listening and reading answers that match available choices", () => {
    expect(validateNestedContent(validLesson(), "lesson[0]")).toEqual([]);
  });

  it("rejects a listening answer that the learner cannot select", () => {
    const lesson = validLesson();
    lesson.listening[0].answer = "Không có trong lựa chọn";

    const errors = validateNestedContent(lesson, "lesson[0]");
    expect(errors.some((error) =>
      error.path === "lesson[0].listening[0].answer" &&
      error.reason.includes("must match one of its choices"),
    )).toBe(true);
  });

  it("rejects a reading answer that the learner cannot select", () => {
    const lesson = validLesson();
    lesson.reading.questions[0].answer = "의사";

    const errors = validateNestedContent(lesson, "lesson[0]");
    expect(errors.some((error) =>
      error.path === "lesson[0].reading.questions[0].answer" &&
      error.reason.includes("must match one of its choices"),
    )).toBe(true);
  });

  it("rejects blank, duplicate, or insufficient choices before they disappear from practice", () => {
    const lesson = validLesson();
    lesson.listening[0].choices = ["네", " 네 "];
    lesson.reading.questions[0].choices = ["학생", ""];

    const errors = validateNestedContent(lesson, "lesson[0]");
    expect(errors.some((error) =>
      error.path === "lesson[0].listening[0].choices" &&
      error.reason.includes("distinct"),
    )).toBe(true);
    expect(errors.some((error) =>
      error.path === "lesson[0].reading.questions[0].choices" &&
      error.reason.includes("blank"),
    )).toBe(true);
  });
});
