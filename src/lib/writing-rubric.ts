import type { LessonContent } from "@/data/content";

export function writingChecks(text: string, lesson: LessonContent | null) {
  const content = lesson?.writing;
  const normalized = text.normalize("NFC");
  const requestedCount = Number(content?.prompt.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*câu/i)?.[1] ?? 1);
  const sentences = normalized.split(/[.!?。！？\n]+/).map(item => item.trim()).filter(Boolean);
  const examples = lesson?.grammar.flatMap(item => item.examples) ?? [];
  const endings = ["입니다", "습니다", "습니까", "어요", "아요", "해요", "세요"].filter(ending => examples.some(example => example.includes(ending)) || content?.hint.includes(ending));
  return [
    { label: `Có ít nhất ${requestedCount} câu theo yêu cầu`, passed: sentences.length >= requestedCount },
    { label: "Có nội dung tiếng Hàn để đối chiếu", passed: (normalized.match(/[가-힣]/g)?.length ?? 0) >= 8 },
    { label: "Có dùng từ gợi ý của bài", passed: (content?.targetWords ?? []).some(word => normalized.includes(word)) },
    { label: endings.length ? "Có đuôi câu xuất hiện trong ví dụ của bài" : "Có dấu kết thúc câu", passed: endings.length ? endings.some(ending => normalized.includes(ending)) : /[.!?。！？]/.test(normalized) },
  ];
}
