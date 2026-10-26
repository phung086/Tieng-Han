import type { RuntimeCourse } from "@/lib/content-store";

const UNVERIFIED_SOURCE = "Chưa xác minh nguồn";

export type CoachEvidence = {
  id: string;
  title: string;
  text: string;
  examples: string[];
  /** Exact per-example provenance; never inherit the parent item's ref. */
  exampleSources: string[];
  source: string;
  href: string;
  kind: string;
};

function exactSource(sourceRef?: string | null): string {
  return typeof sourceRef === "string" && sourceRef.trim()
    ? sourceRef
    : UNVERIFIED_SOURCE;
}

export function coachEvidence(course: RuntimeCourse, lessonId: number): CoachEvidence[] {
  const lesson = course.lessons.find(item => item.id === lessonId);
  if (!lesson) return [];
  const entries: CoachEvidence[] = [];
  for (const item of lesson.grammar) {
    const exampleRefs = (item as typeof item & { exampleSourceRefs?: Array<string | null> }).exampleSourceRefs;
    entries.push({
      id: item.id,
      title: item.pattern,
      text: item.meaning + "\n" + item.explanation,
      examples: item.examples,
      exampleSources: item.examples.map((_, index) => exactSource(exampleRefs?.[index])),
      source: exactSource(item.sourceRef),
      kind: "Ngữ pháp",
      href: "/grammar?lesson=" + lessonId,
    });
  }
  for (const item of lesson.vocabulary) {
    const exampleRef = (item as typeof item & { exampleSourceRef?: string | null }).exampleSourceRef;
    entries.push({
      id: item.id,
      title: item.ko,
      text: item.vi,
      examples: item.example ? [item.example] : [],
      exampleSources: item.example ? [exactSource(exampleRef)] : [],
      source: exactSource(item.sourceRef),
      kind: "Từ vựng",
      href: "/vocabulary?lesson=" + lessonId,
    });
  }
  for (const item of course.questions.filter(item => item.lessonId === lessonId)) {
    const answerRef = (item as typeof item & { answerSourceRef?: string | null }).answerSourceRef;
    entries.push({
      id: item.id,
      title: item.title + " · " + item.prompt,
      text: item.explanation,
      examples: ["Đáp án của câu luyện: " + item.answer],
      exampleSources: [exactSource(answerRef)],
      source: exactSource(item.sourceRef),
      kind: "Lời giải",
      href: "/practice/quiz?lesson=" + lessonId + "&skill=" + item.skill,
    });
  }
  if (lesson.reading) {
    const reading = lesson.reading as typeof lesson.reading & { translationSourceRef?: string | null };
    entries.push({
      id: "reading:" + lessonId,
      title: lesson.reading.title,
      text: lesson.reading.text,
      examples: [lesson.reading.translation],
      exampleSources: [exactSource(reading.translationSourceRef)],
      source: exactSource(lesson.reading.sourceRef),
      kind: "Bài đọc",
      href: "/reading?lesson=" + lessonId,
    });
  }
  for (const item of lesson.pronunciation ?? []) {
    const exampleRefs = (item as typeof item & { exampleSourceRefs?: Array<string | null> }).exampleSourceRefs;
    entries.push({
      id: item.id,
      title: item.title,
      text: item.explanation,
      examples: item.examples,
      exampleSources: item.examples.map((_, index) => exactSource(exampleRefs?.[index])),
      source: exactSource(item.sourceRef),
      kind: "Phát âm",
      href: "/pronunciation?lesson=" + lessonId,
    });
  }
  for (const item of lesson.culture ?? []) {
    entries.push({
      id: item.id,
      title: item.title,
      text: item.text,
      examples: [],
      exampleSources: [],
      source: exactSource(item.sourceRef),
      kind: "Văn hóa",
      href: "/learn/" + lessonId,
    });
  }
  return entries;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").replace(/đ/g, "d");
}
const stopWords = new Set("toi ban minh hay giup cho la cua va ve mot nhung duoc trong voi nhu nao tai sao giai thich nghia tu cau nay bai hoc tieng han muon hoi vi du dung the nao".split(" "));

export function findCoachEvidence(course: RuntimeCourse, lessonId: number, query: string, questionId?: string): CoachEvidence[] {
  const entries = coachEvidence(course, lessonId);
  const normalized = normalize(query.trim());
  if (!normalized) return [];
  if (questionId && /cau vua|dap an|giai thich cau|vi sao sai/.test(normalized)) return entries.filter(item => item.id === questionId);
  const tokens = [...new Set(normalized.split(/\s+/).map(token => token.replace(/[?!.,;:"“”]/g, "")).filter(token => (token.length > 1 || /[\p{Script=Hangul}\p{Script=Han}]/u.test(token)) && !stopWords.has(token)))];
  if (!tokens.length) return [];
  return entries.map(item => {
    const title = normalize(item.title);
    const text = normalize(item.text + " " + item.examples.join(" "));
    const score = tokens.reduce((sum, token) => sum + (title.includes(token) ? 5 : text.includes(token) ? 1 : 0), 0) + (title.includes(normalized) ? 10 : 0);
    return { item, score };
  }).filter(match => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(match => match.item);
}
