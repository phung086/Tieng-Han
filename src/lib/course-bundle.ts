import type { LessonContent, StudyQuestion } from "@/data/content";
import type { LanguageProfile } from "@/lib/language-profile";

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

function isLesson(value: unknown): value is LessonContent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    Number.isFinite(Number(row.id)) &&
    typeof row.title === "string" &&
    typeof row.vi === "string" &&
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
    language:
      root.language && typeof root.language === "object"
        ? (root.language as LanguageProfile)
        : undefined,
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
      lessons: course.lessons as LessonContent[],
      questions: course.questions as StudyQuestion[],
    },
  };
}

export function serializeCourseBundle(
  bundle: CompiledCourseBundle,
) {
  return JSON.stringify(bundle, null, 2);
}
