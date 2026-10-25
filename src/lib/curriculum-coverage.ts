import { z } from "zod";
import type { LessonContent } from "@/data/content";
import type { CompiledCourseBundle } from "@/lib/course-bundle";

const nonempty = z.string().trim().min(1);
export const CURRICULUM_AUDIT_VERSION = 6;
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
      return parts.length === 2 && indexed(index) && at("question", "sourcequestion", "quizquestion", "reviewquestion", "cauhoi", "cauhoigoc", "문항", "원문문항", "퀴즈문항");
    default:
      return false;
  }
}

function indexedPart(value: string | undefined): number {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : -1;
}
/** Return nested source units that must have their own inventory row when an
 * aggregate parent is inventoried. A parent ref cannot silently stand in for
 * its learner-facing examples, turns, choices, prompts, or reading units.
 */
function requiredNestedSourcePointers(lesson: LessonContent, pointer: string): string[] {
  const parts = decodedPointerParts(pointer);
  const index = indexedPart(parts[1]);
  const hasText = (value: unknown) => typeof value === "string" && Boolean(value.trim());
  const required: string[] = [];
  const add = (childPointer: string, value: unknown) => {
    if (hasText(value)) required.push(childPointer);
  };

  if (parts[0] === "vocabulary" && parts.length === 2 && index >= 0) {
    const item = lesson.vocabulary[index];
    if (item) add(pointer + "/example", item.example);
  } else if (parts[0] === "grammar" && parts.length === 2 && index >= 0) {
    const item = lesson.grammar[index];
    if (item) {
      add(pointer + "/pattern", item.pattern);
      item.examples.forEach((example, childIndex) => add(pointer + "/examples/" + childIndex, example));
    }
  } else if (parts[0] === "listening" && parts.length === 2 && index >= 0) {
    const item = lesson.listening[index];
    item?.choices.forEach((choice, childIndex) => add(pointer + "/choices/" + childIndex, choice));
  } else if (parts[0] === "dialogues" && parts.length === 2 && index >= 0) {
    const item = lesson.dialogues?.[index];
    item?.lines.forEach((line, childIndex) => add(pointer + "/lines/" + childIndex, line.targetText || line.ko));
  } else if (parts[0] === "reading" && parts.length === 1 && lesson.reading) {
    add("/reading/title", lesson.reading.title);
    add("/reading/text", lesson.reading.text);
    lesson.reading.questions.forEach((question, questionIndex) => {
      add("/reading/questions/" + questionIndex, question.q);
      question.choices.forEach((choice, choiceIndex) =>
        add("/reading/questions/" + questionIndex + "/choices/" + choiceIndex, choice));
    });
  } else if (parts[0] === "reading" && parts.length === 3 && parts[1] === "questions") {
    const questionIndex = indexedPart(parts[2]);
    const question = questionIndex >= 0 ? lesson.reading?.questions[questionIndex] : undefined;
    question?.choices.forEach((choice, childIndex) =>
      add(pointer + "/choices/" + childIndex, choice));
  } else if (parts[0] === "writing" && parts.length === 1 && lesson.writing) {
    add("/writing/prompt", lesson.writing.prompt);
    lesson.writing.targetWords.forEach((word, childIndex) =>
      add("/writing/targetWords/" + childIndex, word));
  } else if (parts[0] === "pronunciation" && parts.length === 2 && index >= 0) {
    const item = lesson.pronunciation?.[index];
    item?.examples.forEach((example, childIndex) => add(pointer + "/examples/" + childIndex, example));
  } else if (parts[0] === "extraSections" && index >= 0 &&
    ((parts.length === 2) || (parts.length === 3 && parts[2] === "content"))) {
    const item = lesson.extraSections?.[index];
    if (item && item.content.length > 1) {
      item.content.forEach((entry, childIndex) => add("/extraSections/" + index + "/content/" + childIndex, entry));
    }
  }
  return required;
}

/** Resolve evidence for the exact item named by contentPointer. A parent
 * section's sourceRef is never reused for a nested string-array item. */
function sourceRefAtPointer(lesson: LessonContent, pointer: string, resolved: unknown): string | undefined {
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

/** Item-level refs in the bundle are declarations of source-backed units. Every
 * such unit must also appear in the independent inventory; checking only from
 * inventory rows toward nested children misses unlisted children when their
 * parent row is absent (for example, a grammar pattern row without its cited
 * example row). Container-level reading/writing/extra-section refs are excluded.
 */
function declaredItemLevelSourcePointers(lesson: LessonContent): string[] {
  const pointers: string[] = [];
  const add = (pointer: string, ref: unknown) => {
    if (typeof ref === "string" && ref.trim() && !/^Derived from\s+/i.test(ref.trim())) {
      pointers.push(pointer);
    }
  };

  lesson.vocabulary.forEach((item, index) => {
    add("/vocabulary/" + index, item.sourceRef);
    add("/vocabulary/" + index + "/example", item.exampleSourceRef);
  });
  lesson.grammar.forEach((item, index) => {
    // The grammar object ref may describe the containing section; the dedicated
    // pattern/example refs are the unambiguous item-level declarations.
    add("/grammar/" + index + "/pattern", item.patternSourceRef);
    item.exampleSourceRefs?.forEach((ref, childIndex) =>
      add("/grammar/" + index + "/examples/" + childIndex, ref));
  });
  lesson.listening.forEach((item, index) => {
    add("/listening/" + index, item.sourceRef);
    item.choiceSourceRefs?.forEach((ref, childIndex) =>
      add("/listening/" + index + "/choices/" + childIndex, ref));
  });
  lesson.speakingSourceRefs?.forEach((ref, index) => add("/speaking/" + index, ref));
  lesson.dialogues?.forEach((item, index) => {
    if (item.origin !== "derived") {
      item.lines.forEach((line, childIndex) =>
        add("/dialogues/" + index + "/lines/" + childIndex, line.sourceRef));
    }
  });
  if (lesson.reading) {
    add("/reading/title", lesson.reading.titleSourceRef);
    add("/reading/text", lesson.reading.textSourceRef);
    lesson.reading.questions.forEach((question, questionIndex) => {
      add("/reading/questions/" + questionIndex, question.sourceRef);
      question.choiceSourceRefs?.forEach((ref, choiceIndex) =>
        add("/reading/questions/" + questionIndex + "/choices/" + choiceIndex, ref));
    });
  }
  if (lesson.writing) {
    add("/writing/prompt", lesson.writing.promptSourceRef);
    lesson.writing.targetWordSourceRefs?.forEach((ref, index) =>
      add("/writing/targetWords/" + index, ref));
  }
  lesson.pronunciation?.forEach((item, index) => {
    add("/pronunciation/" + index, item.sourceRef);
    item.exampleSourceRefs?.forEach((ref, childIndex) =>
      add("/pronunciation/" + index + "/examples/" + childIndex, ref));
  });
  lesson.culture?.forEach((item, index) => add("/culture/" + index, item.sourceRef));
  lesson.extraSections?.forEach((item, index) => {
    item.contentSourceRefs?.forEach((ref, childIndex) =>
      add("/extraSections/" + index + "/content/" + childIndex, ref));
  });
  lesson.media?.forEach((item, index) => {
    if (item.role !== "external") add("/media/" + index, item.sourceRef);
  });
  lesson.illustrations?.forEach((item, index) => add("/illustrations/" + index, item.sourceRef));
  return pointers;
}

/** A resolved object can be non-empty while its learner-facing source unit is blank.
 * Check the primary text field for each source-bearing pointer before counting it.
 */
function hasPrimarySourceContent(pointer: string, content: unknown): boolean {
  const parts = decodedPointerParts(pointer);
  const hasText = (value: unknown) => typeof value === "string" && Boolean(value.trim());
  if (typeof content === "string") return hasText(content);
  if (Array.isArray(content)) return content.some(hasText);
  if (!content || typeof content !== "object") return false;

  const row = content as Record<string, unknown>;
  const field = (...keys: string[]) => keys.some(key => hasText(row[key]));
  const textArray = (key: string) => Array.isArray(row[key]) && (row[key] as unknown[]).some(hasText);
  switch (parts[0]) {
    case "vocabulary": return parts.length === 2 && field("targetText", "ko");
    case "grammar": return parts.length === 2 && field("pattern");
    case "listening": return parts.length === 2 && field("text");
    case "dialogues": {
      if (parts.length === 4 && parts[2] === "lines") return field("targetText", "ko");
      if (parts.length !== 2 || !Array.isArray(row.lines)) return false;
      return (row.lines as unknown[]).some(line => {
        if (!line || typeof line !== "object" || Array.isArray(line)) return false;
        const turn = line as Record<string, unknown>;
        return hasText(turn.targetText) || hasText(turn.ko);
      });
    }
    case "reading":
      if (parts.length === 1) return field("text");
      if (parts.length === 3 && parts[1] === "questions") return field("q", "prompt");
      return false;
    case "writing": return parts.length === 1 && field("prompt");
    case "pronunciation": return parts.length === 2 && field("explanation");
    case "culture": return parts.length === 2 && field("title") && field("text");
    case "extraSections": return parts.length === 2 && textArray("content");
    case "questions": return parts.length === 2 && field("prompt");
    case "media": return parts.length === 2 && field("url", "src", "fileName", "resourcePath", "dataUrl", "alt", "caption", "text");
    case "illustrations": return parts.length === 2 && field("alt", "caption", "fileName", "url", "src");
    default: return Object.values(row).some(hasText);
  }
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
  const inventoryPointerKeys = new Set(inventory.items.map(item => JSON.stringify([item.lessonId, item.contentPointer])));
  const missingNestedPointers = new Set<string>();
  // Reconcile in the reverse direction too: an explicit item-level source ref in
  // the bundle must not disappear from the inventory denominator merely because
  // no parent inventory row exists to discover it.
  for (const lesson of bundle.course.lessons) {
    const requiredPointers = declaredItemLevelSourcePointers(lesson);
    const lessonQuestions = bundle.course.questions.filter(question => question.lessonId === lesson.id);
    lessonQuestions.forEach((question, index) => {
      if (question.origin === "source" && typeof question.sourceRef === "string" &&
        question.sourceRef.trim() && !/^Derived from\s+/i.test(question.sourceRef.trim())) {
        requiredPointers.push("/questions/" + index);
      }
    });
    for (const pointer of requiredPointers) {
      const pointerKey = JSON.stringify([lesson.id, pointer]);
      if (!inventoryPointerKeys.has(pointerKey)) {
        missingNestedPointers.add(pointerKey);
        issues.push("Thiếu item-level inventory cho nội dung có sourceRef " + lesson.id + ":" + pointer);
      }
    }
  }
  for (const item of inventory.items) {
    const key = item.lessonId + ":" + item.id;
    if (seenItems.has(key)) { issues.push("Trùng source item: " + key); continue; }
    seenItems.add(key);
    const pageKey = sourceKey(item.fileName, item.pageNumber);
    const lesson = bundle.course.lessons.find(lesson => lesson.id === item.lessonId);
    const questions = bundle.course.questions.filter(question => question.lessonId === item.lessonId);
    const content = lesson ? resolvePointer({ ...lesson, questions }, item.contentPointer) : undefined;
    if (lesson) {
      const sectionIndexForChildren = /^\/extraSections\/(\d+)(?:\/|$)/.exec(item.contentPointer)?.[1];
      const isRawTranscriptForChildren = sectionIndexForChildren !== undefined &&
        lesson.extraSections?.[Number(sectionIndexForChildren)]?.kind === "source-transcript";
      if (!isRawTranscriptForChildren) {
        for (const childPointer of requiredNestedSourcePointers(lesson, item.contentPointer)) {
          const childKey = JSON.stringify([item.lessonId, childPointer]);
          if (!inventoryPointerKeys.has(childKey)) {
            missingNestedPointers.add(childKey);
            issues.push("Thiếu item-level inventory cho mục con " + item.lessonId + ":" + childPointer +
              " (được phát hiện từ " + key + ")");
          }
        }
      }
    }
    const isContentPath = /^\/(vocabulary|grammar|listening|speaking|dialogues|pronunciation|culture|extraSections|questions|media|illustrations)\/\d+(\/|$)|^\/(reading|writing)(\/|$)/.test(item.contentPointer);
    const destination = JSON.stringify([item.lessonId, item.contentPointer]);
    const repeatedDestination = destinations.has(destination);
    destinations.add(destination);
    if (repeatedDestination) issues.push("Nhiều source item dùng chung đích nội dung: " + key);
    const sectionIndex = /^\/extraSections\/(\d+)(\/|$)/.exec(item.contentPointer)?.[1];
    const isRawTranscript = sectionIndex !== undefined && lesson?.extraSections?.[Number(sectionIndex)]?.kind === "source-transcript";
    // Both the section object and its whole content array are aggregate destinations.
    // A multi-entry source section must be inventoried through /content/{index} items.
    const sectionContainerMatch = /^\/extraSections\/(\d+)(?:\/content)?$/.exec(item.contentPointer);
    const sectionContainerIndex = sectionContainerMatch?.[1];
    const sectionContainer = sectionContainerIndex === undefined
      ? undefined
      : lesson?.extraSections?.[Number(sectionContainerIndex)];
    if (sectionContainerMatch && !isRawTranscript &&
      Array.isArray(sectionContainer?.content) && sectionContainer.content.length > 1) {
      issues.push("Section nguồn có nhiều mục con; cần kiểm kê từng mục /content/{index} thay vì dùng container: " + key);
      continue;
    }
    const hasContent = isContentPath && !isRawTranscript && !repeatedDestination &&
      hasPrimarySourceContent(item.contentPointer, content);
    if (!hasContent || !expectedPages.has(pageKey) || !item.sourceRef.includes(item.fileName)) {
      issues.push("Thiếu nội dung hoặc nguồn cho item " + key + " → " + item.contentPointer);
      continue;
    }
    if (!sourceKindMatchesPointer(item.kind, item.contentPointer)) {
      issues.push("SOURCE_KIND_POINTER_MISMATCH: loại " + item.kind + " không khớp contentPointer " + item.contentPointer + " cho item " + key);
      continue;
    }
    const targetSourceRef = lesson ? sourceRefAtPointer(lesson, item.contentPointer, content) : undefined;
    if (!targetSourceRef || targetSourceRef !== item.sourceRef.trim()) {
      issues.push("sourceRef inventory không khớp tham chiếu item đích " + key + " → " + item.contentPointer);
      continue;
    }
    represented++;
    representedLessons.add(item.lessonId);
    const linkedQuestions = item.practiceQuestionIds.map(id => questions.find(question =>
      question.id === id && question.sourceRef?.replace(/^Derived from\s+/i, "").trim() === item.sourceRef));
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
    const manualWorkbookTask = item.practiceMethod === "workbook" &&
      !item.motif && item.practiceQuestionIds.length === 0 && (explicitExerciseSection || explicitWritingTask);
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
  const total = inventory.items.length + missingNestedPointers.size;
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
