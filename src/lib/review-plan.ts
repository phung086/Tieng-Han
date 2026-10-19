import type { StudyQuestion } from "@/data/content";
import type { RuntimeCourse } from "@/lib/content-store";
import type { LearningState } from "@/lib/learning-model";
import { buildLessonPracticeBank } from "@/lib/lesson-practice-bank";
import { buildArcadeCards } from "@/lib/review-arcade";

export type ReviewItem = StudyQuestion & {
  reviewKind?: "recall" | "speaking" | "writing";
  context?: string;
  audioText?: string;
};
export const skillNames = {
  vocabulary: "Từ vựng", grammar: "Ngữ pháp", listening: "Nghe", speaking: "Nói", reading: "Đọc", writing: "Viết",
};

export function buildReviewCatalog(course: RuntimeCourse): ReviewItem[] {
  const catalog = new Map<string, ReviewItem>();
  for (const question of course.questions) catalog.set(question.id, question);
  for (const lesson of course.lessons) {
    for (const question of buildLessonPracticeBank(lesson, course.questions)) if (!catalog.has(question.id)) catalog.set(question.id, question);
    const sourceRef = lesson.sourceRef;
    const add = (item: ReviewItem) => { if (!catalog.has(item.id)) catalog.set(item.id, item); };
    for (const word of lesson.vocabulary) add({
      id: word.id, lessonId: lesson.id, skill: "vocabulary", type: "input", reviewKind: "recall",
      title: "Nhớ lại nghĩa của từ", prompt: word.ko, answer: word.vi,
      explanation: word.example, sourceRef: word.sourceRef ?? sourceRef,
    });
    for (const item of lesson.listening) add({
      id: item.id, lessonId: lesson.id, skill: "listening", type: "choice", title: "Nghe và chọn nghĩa",
      prompt: "Nghe câu rồi chọn nghĩa phù hợp.", audioText: item.text, choices: item.choices,
      answer: item.answer, explanation: item.meaning, sourceRef: item.sourceRef ?? sourceRef,
    });
    lesson.speaking.forEach((sentence, index) => add({
      id: `speak-${lesson.id}-${index}`, lessonId: lesson.id, skill: "speaking", type: "input", reviewKind: "speaking",
      title: "Luyện nói lại câu đã học", prompt: sentence, answer: sentence,
      explanation: "Đọc to câu trong giáo trình và tự đánh giá mức độ nhớ. Lượt ôn này không chấm phát âm và không hoàn thành chặng Nói.", sourceRef,
    }));
    for (const item of lesson.reading?.questions ?? []) add({
      id: item.id, lessonId: lesson.id, skill: "reading", type: "choice", title: "Đọc và trả lời",
      prompt: item.q, context: lesson.reading?.text, choices: item.choices, answer: item.answer,
      explanation: `Đáp án trong bài đọc: ${item.answer}. Đối chiếu đoạn văn phía trên.`, sourceRef: item.sourceRef ?? lesson.reading?.sourceRef ?? sourceRef,
    });
    if (lesson.writing) add({
      id: `writing-${lesson.id}`, lessonId: lesson.id, skill: "writing", type: "input", reviewKind: "writing",
      title: "Nhớ lại cách viết", prompt: lesson.writing.prompt, answer: lesson.writing.hint,
      context: "Từ gợi ý trong bài: " + lesson.writing.targetWords.join(" · "),
      explanation: "So sánh bài viết của bạn với gợi ý giáo trình. Đây là lượt tự đánh giá để lên lịch ôn; không phải chấm ngữ pháp tự động.", sourceRef: lesson.writing.sourceRef ?? sourceRef,
    });
  }
  for (const card of buildArcadeCards(course.lessons)) if (!catalog.has(card.knowledgeId)) catalog.set(card.knowledgeId,{
    id:card.knowledgeId,lessonId:card.lessonId,skill:card.skill,type:"input",reviewKind:"recall",title:"Nhớ lại mục đã học",prompt:card.prompt,answer:card.answer,explanation:card.note,sourceRef:card.sourceRef,
  });
  return [...catalog.values()];
}

export function reviewSummary(course: RuntimeCourse, state: LearningState, today: string) {
  const learned = buildReviewCatalog(course).filter(item => state.mastery[item.id]).map(item => ({ ...item, ...state.mastery[item.id] }));
  const due = learned.filter(item => item.dueAt <= today).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.strength - b.strength || a.id.localeCompare(b.id));
  const weak = learned.filter(item => item.strength < 70).sort((a, b) => a.strength - b.strength || a.dueAt.localeCompare(b.dueAt));
  const nextDue = learned.filter(item => item.dueAt > today).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt;
  return { learned, due, weak, nextDue };
}

export function selectReviewQuestions(course: RuntimeCourse, state: LearningState, today: string, itemId?: string, limit?: number): ReviewItem[] {
  const summary = reviewSummary(course, state, today);
  if (itemId) return summary.learned.filter(item => item.id === itemId);
  return limit === undefined ? summary.due : summary.due.slice(0, Math.max(0, limit));
}

export function reviewHref(itemId?: string) {
  return "/practice/quiz?mode=review" + (itemId ? "&item=" + encodeURIComponent(itemId) : "");
}

export function formatReviewDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}
