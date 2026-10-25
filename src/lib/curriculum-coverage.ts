import { z } from "zod";
import type { LessonContent, StudyQuestion } from "@/data/content";
import type { CompiledCourseBundle } from "@/lib/course-bundle";

const nonempty = z.string().trim().min(1);
export const CURRICULUM_AUDIT_VERSION = 5;
export const sourceInventorySchema = z.object({
  version: z.literal(1),
  pages: z.array(z.object({
    fileName: nonempty, pageNumber: z.number().int().positive(),
    status: z.enum(["reviewed", "unavailable"]), reason: nonempty.optional(),
    classification: z.enum(["learning-content", "non-learning"]).optional(),
  })),
  items: z.array(z.object({
    id: nonempty, lessonId: z.number().int().positive(), kind: nonempty,
    fileName: nonempty, pageNumber: z.number().int().positive(), sourceRef: nonempty,
    // JSON pointer relative to the lesson, e.g. /vocabulary/0 or /grammar/0/examples/1.
    contentPointer: nonempty,
    practiceMethod: z.enum(["questions", "workbook"]),
    // Canonical quiz form; required for question-based practice and matched by a linked question.
    motif: z.enum(["choice", "input", "reorder"]).optional(),
    practiceQuestionIds: z.array(nonempty).default([]), verified: z.boolean(),
  })),
});
export type SourceInventory = z.infer<typeof sourceInventorySchema>;
export type CoverageRatio = { covered: number; total: number; percent: number | null };
export type CurriculumCoverage = {
  auditVersion?: number;
  status: "unverified" | "partial" | "blocked" | "complete";
  basis: string;
  sourceCoverage: CoverageRatio;
  practiceCoverage: CoverageRatio;
  validationCoverage: CoverageRatio;
  derivedContent: number;
  issues: string[];
};
export function isCurrentCompleteCoverage(coverage: CurriculumCoverage | undefined) {
  return coverage?.auditVersion === CURRICULUM_AUDIT_VERSION && coverage.status === "complete";
}
const ratio = (covered: number, total: number): CoverageRatio => ({ covered, total, percent: total ? covered / total * 100 : null });

function resolvePointer(root: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let value = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (["__proto__", "constructor", "prototype"].includes(key) || !value || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
const sourceKey = (fileName: string, pageNumber: number) => JSON.stringify([fileName, pageNumber]);

function decodedPointerParts(pointer: string): string[] {
  if (!pointer.startsWith("/")) return [];
  return pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function sourceKindMatchesPointer(kind: string, pointer: string): boolean {
  const normalizeKind = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^a-z0-9\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+/g, "");
  const normalized = normalizeKind(kind);
  const parts = decodedPointerParts(pointer);
  const at = (...aliases: string[]) => aliases.some(alias => normalizeKind(alias) === normalized);
  const indexed = (value: string | undefined) => value !== undefined && /^\d+$/.test(value);
  if (!parts.length) return false;
  const [root, index, child, childIndex] = parts;
  switch (root) {
    case "vocabulary":
      if (parts.length === 2 && indexed(index)) return at("vocabulary", "vocab", "word", "vocabularyitem", "worditem", "tuvung", "tumo", "어휘", "단어");
      if (parts.length === 3 && indexed(index) && child === "example") return at("vocabularyexample", "vocabexample", "wordexample", "examplevocabulary", "tuvungexample", "cauvidutuvung", "어휘예문", "단어예문");
      return false;
    case "grammar":
      if (parts.length === 2 && indexed(index)) return at("grammar", "grammarrule", "nguphap", "문법", "문법규칙");
      if (parts.length === 3 && indexed(index) && child === "pattern") return at("grammarpattern", "pattern", "nguphappattern", "maunguphap", "문법패턴");
      if (parts.length === 4 && indexed(index) && child === "examples" && indexed(childIndex)) return at("grammarexample", "grammarsample", "nguphapexample", "caumau", "문법예문", "예문");
      return false;
    case "listening":
      if (parts.length === 2 && indexed(index)) return at("listening", "listeningitem", "listeningquestion", "audio", "nghe", "bainghe", "듣기", "듣기문항");
      if (parts.length === 4 && indexed(index) && child === "choices" && indexed(childIndex)) return at("listeningchoice", "audiochoice", "ngheluachon", "luachonnghe", "듣기선택지");
      return false;
    case "speaking":
      return parts.length === 2 && indexed(index) && at("speaking", "speakingprompt", "noi", "promptnoi", "말하기", "말하기프롬프트");
    case "dialogues":
      if (parts.length === 2 && indexed(index)) return at("dialogue", "dialogueitem", "conversation", "hoithoai", "doanthoai", "대화", "회화");
      if (parts.length === 4 && indexed(index) && child === "lines" && indexed(childIndex)) return at("dialogueline", "dialogueturn", "conversationline", "hoithoailine", "luotthoai", "대화문장", "회화문장");
      return false;
    case "reading":
      if (parts.length === 1) return at("reading", "readingsection", "readingactivity", "docsection", "baidocsection", "읽기섹션", "독해섹션");
      if (parts.length === 2 && parts[1] === "title") return at("readingtitle", "tieudedoc", "읽기제목");
      if (parts.length === 2 && parts[1] === "text") return at("readingpassage", "readingtext", "doc", "baidoc", "읽기", "독해", "읽기지문");
      if (parts.length === 3 && parts[1] === "questions" && indexed(parts[2])) return at("readingquestion", "comprehensionquestion", "docquestion", "cauhoidoc", "읽기문항", "독해문항");
      if (parts.length === 5 && parts[1] === "questions" && indexed(parts[2]) && parts[3] === "choices" && indexed(parts[4])) return at("readingchoice", "docchoice", "luachondoc", "읽기선택지");
      return false;
    case "writing":
      if (parts.length === 1) return at("writing", "writingtask", "viet", "baitapviet", "nhiemvuviet", "쓰기", "작문", "쓰기과제");
      if (parts.length === 2 && parts[1] === "prompt") return at("writingprompt", "writinginstruction", "promptviet", "yeucauviet", "쓰기프롬프트", "쓰기지시문");
      if (parts.length === 3 && parts[1] === "targetWords" && indexed(parts[2])) return at("writingtargetword", "targetword", "writingword", "tukhoa", "tukhoaviet", "tukhoabaitviet", "쓰기목표단어", "목표단어");
      return false;
    case "pronunciation":
      if (parts.length === 2 && indexed(index)) return at("pronunciation", "pronunciationitem", "pronunciationrule", "phatam", "quytacphatam", "발음", "발음규칙");
      if (parts.length === 4 && indexed(index) && child === "examples" && indexed(childIndex)) return at("pronunciationexample", "phatamexample", "viduphatam", "발음예문");
      return false;
    case "culture":
      return parts.length === 2 && indexed(index) && at("culture", "culturalnote", "vanhoa", "noidungvanhoa", "문화", "문화노트");
    case "extraSections":
      if (parts.length === 2 && indexed(index)) return at("extrasection", "exercisesection", "workbooksection", "supplementsection", "activitysection", "exercisegroup", "baitapsection", "연습섹션", "보충섹션");
      if (parts.length === 4 && indexed(index) && child === "content" && indexed(childIndex)) return at("extrasectionitem", "exercise", "workbook", "worksheet", "task", "problem", "question", "translation", "drill", "practice", "baitap", "baitapgoc", "dich", "supplement", "baitapbosung", "연습", "문제", "과제", "번역", "보충문제");
      return false;
    case "media":
      return parts.length === 2 && indexed(index) && at("media", "illustration", "image", "diagram", "audio", "video", "document", "sourcepage", "minhhoa", "anhminhhoa", "삽화", "그림", "도표", "미디어");
    case "illustrations":
      return parts.length === 2 && indexed(index) && at("illustration", "image", "diagram", "contextillustration", "vocabularyillustration", "grammarillustration", "dialogueillustration", "minhhoa", "anhminhhoa", "삽화", "그림", "도표");
    case "questions":
      if (parts.length === 2 && indexed(index)) return at("question", "sourcequestion", "quizquestion", "reviewquestion", "cauhoi", "cauhoigoc", "문항", "원문문항", "퀴즈문항");
      if (parts.length === 4 && indexed(index) && child === "choices" && indexed(childIndex)) {
        return at("questionChoice", "quizChoice", "sourceQuestionChoice", "questionOption", "choiceOption", "cauhoiluachon", "luachoncauhoi", "문항선택지");
      }
      return false;
    default:
      return false;
  }
}

function indexedPart(value: string | undefined): number {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : -1;
}

/** Resolve evidence for the exact item named by contentPointer. A parent
 * section's sourceRef is never reused for a nested string-array item. */
function sourceRefAtPointer(lesson: LessonContent, pointer: string, resolved: unknown, questions: StudyQuestion[]): string | undefined {
  if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
    const ref = (resolved as { sourceRef?: unknown }).sourceRef;
    if (typeof ref === "string" && ref.trim()) return ref.trim();
  }
  const parts = decodedPointerParts(pointer);
  const root = parts[0];
  const index = indexedPart(parts[1]);
  const child = parts[2];
  const childIndex = indexedPart(parts[3]);
  if (root === "reading" && parts.length === 2 && parts[1] === "title") {
    return lesson.reading?.titleSourceRef?.trim() || undefined;
  }
  if (root === "reading" && parts.length === 2 && parts[1] === "text") {
    return lesson.reading?.textSourceRef?.trim() || undefined;
  }
  if (root === "writing" && parts.length === 2 && parts[1] === "prompt") {
    return lesson.writing?.promptSourceRef?.trim() || undefined;
  }
  if (root === "writing" && parts[1] === "targetWords" && parts.length === 3) {
    const targetIndex = indexedPart(parts[2]);
    return targetIndex >= 0 ? lesson.writing?.targetWordSourceRefs?.[targetIndex]?.trim() || undefined : undefined;
  }
  if (root === "questions" && parts.length === 4 && child === "choices") {
    return index >= 0 && childIndex >= 0
      ? questions[index]?.choiceSourceRefs?.[childIndex]?.trim() || undefined
      : undefined;
  }
  if (root === "reading" && parts.length === 5 && parts[1] === "questions" && parts[3] === "choices") {
    const questionIndex = indexedPart(parts[2]);
    const choiceIndex = indexedPart(parts[4]);
    return questionIndex >= 0 && choiceIndex >= 0
      ? lesson.reading?.questions[questionIndex]?.choiceSourceRefs?.[choiceIndex]?.trim() || undefined
      : undefined;
  }
  if (index < 0) return undefined;
  if (root === "grammar" && child === "pattern" && parts.length === 3) {
    return lesson.grammar[index]?.patternSourceRef?.trim() || undefined;
  }
  if (root === "listening" && child === "choices" && parts.length === 4) {
    return lesson.listening[index]?.choiceSourceRefs?.[childIndex]?.trim() || undefined;
  }
  if (root === "speaking" && parts.length === 2) return lesson.speakingSourceRefs?.[index]?.trim() || undefined;
  if (root === "vocabulary" && child === "example" && parts.length === 3) return lesson.vocabulary[index]?.exampleSourceRef?.trim() || undefined;
  if (root === "grammar" && child === "examples" && parts.length === 4) return lesson.grammar[index]?.exampleSourceRefs?.[childIndex]?.trim() || undefined;
  if (root === "pronunciation" && child === "examples" && parts.length === 4) return lesson.pronunciation?.[index]?.exampleSourceRefs?.[childIndex]?.trim() || undefined;
  if (root === "extraSections" && child === "content" && parts.length === 4) return lesson.extraSections?.[index]?.contentSourceRefs?.[childIndex]?.trim() || undefined;
  return undefined;
}

/** Structural reconciliation against a submitted, independently reviewed source
 * inventory. It does not pretend that schema validation reads the PDF itself.
 */
export function auditCurriculumCoverage(bundle: CompiledCourseBundle): CurriculumCoverage {
  const derivedContent = bundle.course.questions.filter(question => question.origin === "derived").length;
  const empty = { auditVersion: CURRICULUM_AUDIT_VERSION, sourceCoverage: ratio(0, 0), practiceCoverage: ratio(0, 0), validationCoverage: ratio(0, 0), derivedContent };
  if (!bundle.sourceInventory) return { ...empty, status: "unverified", basis: "No independent source inventory", issues: ["Chưa có kiểm kê nguồn được đối chiếu độc lập."] };
  const inventory = sourceInventorySchema.parse(bundle.sourceInventory);
  const issues: string[] = [];
  const expectedPages = new Set<string>();
  for (const source of bundle.sourceManifest ?? []) {
    for (let page = 1; page <= source.pageCount; page++) expectedPages.add(sourceKey(source.name, page));
  }
  if (!expectedPages.size) issues.push("Thiếu sourceManifest để xác minh phạm vi tài liệu.");
  const reviewedPages = new Set<string>();
  const seenPages = new Set<string>();
  for (const page of inventory.pages) {
    const key = sourceKey(page.fileName, page.pageNumber);
    if (seenPages.has(key)) issues.push("Trùng trang kiểm kê: " + key);
    seenPages.add(key);
    if (!expectedPages.has(key)) issues.push("Trang ngoài nguồn: " + key);
    if (page.status === "reviewed") reviewedPages.add(key);
    else issues.push("Trang bất khả dụng: " + key + ": " + (page.reason ?? "chưa ghi lý do"));
  }
  for (const key of expectedPages) if (!reviewedPages.has(key)) issues.push("Trang chưa được đối chiếu: " + key);
  for (const page of inventory.pages) {
    if (page.status !== "reviewed") continue;
    const key = sourceKey(page.fileName, page.pageNumber);
    const pageItems = inventory.items.filter(item => item.fileName === page.fileName && item.pageNumber === page.pageNumber);
    if (page.classification === "non-learning") {
      if (!page.reason || pageItems.length) issues.push("Trang loại khỏi nội dung học phải có lý do và không có item: " + key);
    } else if (page.classification !== "learning-content" || !pageItems.length) {
      issues.push("Trang chưa có kiểm kê đơn vị nội dung (không được chỉ đánh dấu đã đọc): " + key);
    }
  }
  for (const lesson of bundle.course.lessons) {
    const aligned = (refs: string[] | undefined, count: number, path: string) => {
      if (refs && (refs.length !== count || refs.some(ref => !ref.trim()))) {
        issues.push("Mảng tham chiếu item không khớp nội dung tại " + path);
      }
    };
    aligned(lesson.speakingSourceRefs, lesson.speaking.length, "lesson " + lesson.id + ".speaking");
    lesson.listening.forEach((item, index) =>
      aligned(item.choiceSourceRefs, item.choices.length, "lesson " + lesson.id + ".listening[" + index + "].choices"));
    lesson.reading?.questions.forEach((question, index) =>
      aligned(question.choiceSourceRefs, question.choices.length, "lesson " + lesson.id + ".reading.questions[" + index + "].choices"));
    bundle.course.questions.filter(question => question.lessonId === lesson.id).forEach((question, index) =>
      aligned(question.choiceSourceRefs, question.choices?.length ?? 0, "lesson " + lesson.id + ".questions[" + index + "].choices"));
    lesson.vocabulary.forEach((item, index) => {
      if (item.exampleSourceRef !== undefined && !item.exampleSourceRef.trim()) issues.push("Tham chiếu ví dụ từ vựng rỗng tại lesson " + lesson.id + ".vocabulary[" + index + "]");
    });
    lesson.grammar.forEach((item, index) => {
      if (item.patternSourceRef !== undefined && !item.patternSourceRef.trim()) {
        issues.push("Tham chiếu mẫu ngữ pháp rỗng tại lesson " + lesson.id + ".grammar[" + index + "].pattern");
      }
      aligned(item.exampleSourceRefs, item.examples.length, "lesson " + lesson.id + ".grammar[" + index + "].examples");
    });
    lesson.pronunciation?.forEach((item, index) => aligned(item.exampleSourceRefs, item.examples.length, "lesson " + lesson.id + ".pronunciation[" + index + "].examples"));
    lesson.extraSections?.forEach((item, index) => aligned(item.contentSourceRefs, item.content.length, "lesson " + lesson.id + ".extraSections[" + index + "].content"));
    if (lesson.writing) aligned(lesson.writing.targetWordSourceRefs, lesson.writing.targetWords.length, "lesson " + lesson.id + ".writing.targetWords");
    if (lesson.reading?.titleSourceRef !== undefined && !lesson.reading.titleSourceRef.trim()) {
      issues.push("Tham chiếu tiêu đề bài đọc rỗng tại lesson " + lesson.id + ".reading.title");
    }
    if (lesson.reading?.textSourceRef !== undefined && !lesson.reading.textSourceRef.trim()) {
      issues.push("Tham chiếu nội dung bài đọc rỗng tại lesson " + lesson.id + ".reading.text");
    }
    if (lesson.writing?.promptSourceRef !== undefined && !lesson.writing.promptSourceRef.trim()) {
      issues.push("Tham chiếu prompt bài viết rỗng tại lesson " + lesson.id + ".writing.prompt");
    }
  }
  const allPagesReviewed = expectedPages.size > 0 && issues.length === 0;
  let represented = 0;
  let practiced = 0;
  let validated = 0;
  const seenItems = new Set<string>();
  const representedLessons = new Set<number>();
  const destinations = new Set<string>();
  for (const item of inventory.items) {
    const key = item.lessonId + ":" + item.id;
    if (seenItems.has(key)) { issues.push("Trùng source item: " + key); continue; }
    seenItems.add(key);
    const pageKey = sourceKey(item.fileName, item.pageNumber);
    const lesson = bundle.course.lessons.find(lesson => lesson.id === item.lessonId);
    const questions = bundle.course.questions.filter(question => question.lessonId === item.lessonId);
    const content = lesson ? resolvePointer({ ...lesson, questions }, item.contentPointer) : undefined;
    const isContentPath = /^\/(vocabulary|grammar|listening|speaking|dialogues|pronunciation|culture|extraSections|questions|media|illustrations)\/\d+(\/|$)|^\/(reading|writing)(\/|$)/.test(item.contentPointer);
    const destination = JSON.stringify([item.lessonId, item.contentPointer]);
    const repeatedDestination = destinations.has(destination);
    destinations.add(destination);
    if (repeatedDestination) issues.push("Nhiều source item dùng chung đích nội dung: " + key);
    const sectionIndex = /^\/extraSections\/(\d+)(\/|$)/.exec(item.contentPointer)?.[1];
    const isRawTranscript = sectionIndex !== undefined && lesson?.extraSections?.[Number(sectionIndex)]?.kind === "source-transcript";
    const hasContent = isContentPath && !isRawTranscript && !repeatedDestination && content !== undefined && content !== null &&
      (typeof content !== "string" || Boolean(content.trim())) &&
      (!Array.isArray(content) || content.length > 0);
    if (!hasContent || !expectedPages.has(pageKey) || !item.sourceRef.includes(item.fileName)) {
      issues.push("Thiếu nội dung hoặc nguồn cho item " + key + " → " + item.contentPointer);
      continue;
    }
    if (!sourceKindMatchesPointer(item.kind, item.contentPointer)) {
      issues.push("SOURCE_KIND_POINTER_MISMATCH: loại " + item.kind + " không khớp contentPointer " + item.contentPointer + " cho item " + key);
      continue;
    }
    const targetSourceRef = lesson ? sourceRefAtPointer(lesson, item.contentPointer, content, questions) : undefined;
    if (!targetSourceRef || targetSourceRef !== item.sourceRef.trim()) {
      issues.push("sourceRef inventory không khớp tham chiếu item đích " + key + " → " + item.contentPointer);
      continue;
    }
    represented++;
    representedLessons.add(item.lessonId);
    const choicePointer = /^\/questions\/(\d+)\/choices\/(\d+)$/.exec(item.contentPointer);
    const choiceQuestion = choicePointer ? questions[Number(choicePointer[1])] : undefined;
    const choiceIndex = choicePointer ? Number(choicePointer[2]) : -1;
    const linkedQuestions = item.practiceQuestionIds.map(id => questions.find(question =>
      question.id === id && (choicePointer
        ? question.id === choiceQuestion?.id &&
          question.choiceSourceRefs?.[choiceIndex]?.replace(/^Derived from\s+/i, "").trim() === item.sourceRef
        : question.sourceRef?.replace(/^Derived from\s+/i, "").trim() === item.sourceRef)));
    const linked = linkedQuestions.length > 0 && linkedQuestions.every(question => question !== undefined);
    const motifMissing = item.practiceMethod === "questions" && !item.motif;
    const motifMatches = item.motif
      ? linkedQuestions.some(question => question?.type === item.motif)
      : !motifMissing;
    // Workbook coverage requires an explicit exercise target, not merely any lesson content.
    const sectionMatch = /^\/extraSections\/(\d+)(?:\/content\/\d+)?$/.exec(item.contentPointer);
    const section = sectionMatch ? lesson?.extraSections?.[Number(sectionMatch[1])] : undefined;
    const exerciseKind = /(?:exercise|workbook|practice|worksheet|drill|task|problem|question|translation|fill[-_ ]?in|matching|reorder|연습|문제)/i;
    const targetHasContent = typeof content === "string"
      ? Boolean(content.trim())
      : Array.isArray(content)
        ? content.some(value => typeof value === "string" && Boolean(value.trim()))
        : Boolean(section?.content?.some(value => typeof value === "string" && Boolean(value.trim())));
    const explicitExerciseSection = Boolean(
      section && exerciseKind.test(section.kind) && exerciseKind.test(item.kind) && targetHasContent,
    );
    const writing = lesson?.writing;
    const explicitWritingTask = item.contentPointer === "/writing" &&
      /(?:writing|exercise|workbook|practice|worksheet|task|translation|연습|작문)/i.test(item.kind) &&
      Boolean(writing && typeof writing.prompt === "string" && writing.prompt.trim());
    // The existing source-workbook route exposes culture notes as manually
    // completable reading items. Permit that exact target without inventing a
    // quiz answer, but only when both authored fields are present.
    const culturePointer = item.contentPointer.split("/");
    const cultureIndex = culturePointer.length === 3 && culturePointer[1] === "culture" &&
      culturePointer[2] !== "" && Number.isInteger(Number(culturePointer[2])) && Number(culturePointer[2]) >= 0
      ? Number(culturePointer[2]) : -1;
    const cultureItem = cultureIndex >= 0 ? lesson?.culture?.[cultureIndex] : undefined;
    const explicitCultureNote = Boolean(cultureItem && cultureItem.title.trim() && cultureItem.text.trim());
    const manualWorkbookTask = item.practiceMethod === "workbook" &&
      !item.motif && item.practiceQuestionIds.length === 0 &&
      (explicitExerciseSection || explicitWritingTask || explicitCultureNote);
    // Every mapped question must resolve to this exact source item. When the reviewed
    // inventory specifies a supported motif, at least one linked question must preserve it.
    if (motifMissing) {
      issues.push("Thiếu motif luyện tập cho item " + key + " với practiceMethod=questions");
    }
    if (item.motif && !motifMatches) {
      issues.push("Sai motif luyện tập cho item " + key + ": yêu cầu " + item.motif);
    }
    if ((linked && motifMatches) || manualWorkbookTask) practiced++;
    else if (!linked) issues.push("Thiếu phương thức ôn luyện cho item " + key);
    if (item.verified && reviewedPages.has(pageKey)) validated++;
    else issues.push("Item chưa kiểm chứng: " + key);
  }
  for (const lesson of bundle.course.lessons) {
    if (!representedLessons.has(lesson.id)) issues.push("Lesson chưa có item kiểm kê: " + lesson.id);
  }
  const total = inventory.items.length;
  if (!total) issues.push("Inventory rỗng không chứng minh độ đầy đủ.");
  return {
    auditVersion: CURRICULUM_AUDIT_VERSION,
    status: !issues.length ? "complete" : represented ? "partial" : "blocked",
    basis: "Reconciled against submitted reviewed inventory; not automatic PDF semantic verification",
    sourceCoverage: { ...ratio(represented, total), percent: allPagesReviewed ? ratio(represented, total).percent : null },
    practiceCoverage: ratio(practiced, total),
    validationCoverage: ratio(validated, total), derivedContent, issues,
  };
}
