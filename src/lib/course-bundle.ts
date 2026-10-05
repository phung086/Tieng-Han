import type {
  DialogueItem,
  LessonContent,
  StudyQuestion,
  VocabularyItem,
} from "@/data/content";
import {
  createLanguageProfile,
  type LanguageProfile,
  type WritingSystem,
} from "@/lib/language-profile";

export const COURSE_BUNDLE_FORMAT = "haneul-course-bundle";
export const COURSE_BUNDLE_VERSION = 1;

export type CompiledCourseBundle = {
  format: typeof COURSE_BUNDLE_FORMAT;
  version: typeof COURSE_BUNDLE_VERSION;
  generatedAt?: string;
  language?: LanguageProfile;
  sourceFiles?: string[];
  sourceManifest?: Array<{
    name: string;
    size: number;
    lastModified: number;
    pageCount: number;
    sha256: string;
  }>;
  course: {
    title: string;
    level: string;
    edition?: string;
    lessons: LessonContent[];
    questions: StudyQuestion[];
  };
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeVocabularyItem(value: unknown): VocabularyItem {
  const row = (value ?? {}) as Record<string, unknown>;
  const targetText = stringValue(row.targetText) || stringValue(row.ko);
  const learnerMeaning =
    stringValue(row.learnerMeaning) || stringValue(row.vi);

  return {
    ...(row as unknown as VocabularyItem),
    id: stringValue(row.id),
    targetText,
    learnerMeaning,
    ko: targetText,
    vi: learnerMeaning,
    example: stringValue(row.example),
    sourceRef:
      typeof row.sourceRef === "string" ? row.sourceRef : undefined,
  };
}

function normalizeDialogue(value: unknown): DialogueItem {
  const row = (value ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(row.lines)
    ? row.lines.map((line) => {
        const lineRow = (line ?? {}) as Record<string, unknown>;
        const targetText =
          stringValue(lineRow.targetText) || stringValue(lineRow.ko);
        const learnerMeaning =
          stringValue(lineRow.learnerMeaning) || stringValue(lineRow.vi);

        return {
          speaker:
            typeof lineRow.speaker === "string"
              ? lineRow.speaker
              : undefined,
          targetText,
          learnerMeaning: learnerMeaning || undefined,
          ko: targetText,
          vi: learnerMeaning || undefined,
        };
      })
    : [];

  return {
    ...(row as unknown as DialogueItem),
    id: stringValue(row.id),
    title: typeof row.title === "string" ? row.title : undefined,
    lines,
    sourceRef:
      typeof row.sourceRef === "string" ? row.sourceRef : undefined,
  };
}

export function normalizeLessonContent(value: unknown): LessonContent {
  const row = (value ?? {}) as Record<string, unknown>;
  const targetTitle =
    stringValue(row.targetTitle) || stringValue(row.title);
  const learnerTitle =
    stringValue(row.learnerTitle) || stringValue(row.vi);

  return {
    ...(row as unknown as LessonContent),
    id: Number(row.id),
    targetTitle,
    learnerTitle,
    title: targetTitle,
    vi: learnerTitle,
    objective: stringValue(row.objective),
    vocabulary: Array.isArray(row.vocabulary)
      ? row.vocabulary.map(normalizeVocabularyItem)
      : [],
    grammar: Array.isArray(row.grammar)
      ? (row.grammar as LessonContent["grammar"])
      : [],
    listening: Array.isArray(row.listening)
      ? (row.listening as LessonContent["listening"])
      : [],
    speaking: Array.isArray(row.speaking)
      ? row.speaking.map(String)
      : [],
    reading:
      row.reading && typeof row.reading === "object"
        ? (row.reading as LessonContent["reading"])
        : null,
    writing:
      row.writing && typeof row.writing === "object"
        ? (row.writing as LessonContent["writing"])
        : null,
    dialogues: Array.isArray(row.dialogues)
      ? row.dialogues.map(normalizeDialogue)
      : undefined,
    pronunciation: Array.isArray(row.pronunciation)
      ? (row.pronunciation as LessonContent["pronunciation"])
      : undefined,
    culture: Array.isArray(row.culture)
      ? (row.culture as LessonContent["culture"])
      : undefined,
    extraSections: Array.isArray(row.extraSections)
      ? (row.extraSections as LessonContent["extraSections"])
      : undefined,
    media: Array.isArray(row.media)
      ? (row.media as LessonContent["media"])
      : undefined,
    sourceRef:
      typeof row.sourceRef === "string" ? row.sourceRef : undefined,
    quality:
      row.quality && typeof row.quality === "object"
        ? (row.quality as LessonContent["quality"])
        : undefined,
  };
}

function isLesson(value: unknown): value is LessonContent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  const title =
    typeof row.targetTitle === "string"
      ? row.targetTitle
      : row.title;
  const learnerTitle =
    typeof row.learnerTitle === "string"
      ? row.learnerTitle
      : row.vi;

  return (
    Number.isFinite(Number(row.id)) &&
    typeof title === "string" &&
    typeof learnerTitle === "string" &&
    typeof row.objective === "string" &&
    Array.isArray(row.vocabulary) &&
    Array.isArray(row.grammar) &&
    Array.isArray(row.listening) &&
    Array.isArray(row.speaking)
  );
}

function isQuestion(value: unknown): value is StudyQuestion {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    Number.isFinite(Number(row.lessonId)) &&
    typeof row.skill === "string" &&
    typeof row.type === "string" &&
    typeof row.prompt === "string" &&
    typeof row.answer === "string"
  );
}

function normalizeLanguage(value: unknown): LanguageProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const target = stringValue(row.target);
  if (!target) return undefined;

  return createLanguageProfile({
    target,
    learner: stringValue(row.learner) || "vi",
    targetName: stringValue(row.targetName) || undefined,
    learnerName: stringValue(row.learnerName) || undefined,
    locale: stringValue(row.locale) || undefined,
    script:
      typeof row.script === "string"
        ? (row.script as WritingSystem)
        : undefined,
  });
}

export function parseCourseBundle(rawText: string): CompiledCourseBundle {
  const parsed = JSON.parse(rawText) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Course bundle phải là một JSON object.");
  }

  const root = parsed as Record<string, unknown>;

  if (root.format !== COURSE_BUNDLE_FORMAT) {
    throw new Error("File không phải Haneul Course Bundle.");
  }

  if (Number(root.version) !== COURSE_BUNDLE_VERSION) {
    throw new Error(
      "Phiên bản course bundle chưa được hỗ trợ: " + String(root.version),
    );
  }

  if (!root.course || typeof root.course !== "object") {
    throw new Error("Course bundle thiếu trường course.");
  }

  const course = root.course as Record<string, unknown>;

  if (
    typeof course.title !== "string" ||
    typeof course.level !== "string" ||
    !Array.isArray(course.lessons) ||
    !Array.isArray(course.questions)
  ) {
    throw new Error("Metadata hoặc dữ liệu lesson/question của bundle không hợp lệ.");
  }

  if (!course.lessons.every(isLesson)) {
    throw new Error("Một hoặc nhiều lesson trong bundle không hợp lệ.");
  }

  if (!course.questions.every(isQuestion)) {
    throw new Error("Một hoặc nhiều question trong bundle không hợp lệ.");
  }

  return {
    format: COURSE_BUNDLE_FORMAT,
    version: COURSE_BUNDLE_VERSION,
    generatedAt:
      typeof root.generatedAt === "string" ? root.generatedAt : undefined,
    language: normalizeLanguage(root.language),
    sourceFiles: Array.isArray(root.sourceFiles)
      ? root.sourceFiles.map(String)
      : undefined,
    sourceManifest: Array.isArray(root.sourceManifest)
      ? root.sourceManifest
          .map((item) => {
            const row = item as Record<string, unknown>;
            return {
              name: String(row.name ?? ""),
              size: Number(row.size ?? 0),
              lastModified: Number(row.lastModified ?? 0),
              pageCount: Number(row.pageCount ?? 0),
              sha256: String(row.sha256 ?? ""),
            };
          })
          .filter(
            (item) =>
              item.name &&
              item.sha256 &&
              Number.isFinite(item.size) &&
              Number.isFinite(item.pageCount),
          )
      : undefined,
    course: {
      title: course.title,
      level: course.level,
      edition:
        typeof course.edition === "string" ? course.edition : undefined,
      lessons: course.lessons.map(normalizeLessonContent),
      questions: course.questions as StudyQuestion[],
    },
  };
}

export function serializeCourseBundle(
  bundle: CompiledCourseBundle,
) {
  return JSON.stringify(bundle, null, 2);
}
