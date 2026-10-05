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

export type BundleValidationError = {
  path: string;
  reason: string;
  expected?: string;
};

const VALID_SKILLS = new Set([
  "vocabulary",
  "grammar",
  "listening",
  "speaking",
  "reading",
  "writing",
]);

const VALID_QUESTION_TYPES = new Set(["choice", "input", "reorder"]);

function validateLesson(
  value: unknown,
  index: number,
): BundleValidationError[] {
  const errors: BundleValidationError[] = [];
  const prefix = `lesson[${index}]`;

  if (!value || typeof value !== "object") {
    errors.push({ path: prefix, reason: "must be an object" });
    return errors;
  }

  const row = value as Record<string, unknown>;

  // id
  if (!Number.isFinite(Number(row.id))) {
    errors.push({
      path: `${prefix}.id`,
      reason: "must be a finite number",
      expected: "number",
    });
  }

  // title: targetTitle+learnerTitle or title+vi
  const hasTargetTitle = typeof row.targetTitle === "string" && row.targetTitle;
  const hasLearnerTitle =
    typeof row.learnerTitle === "string" && row.learnerTitle;
  const hasLegacyTitle = typeof row.title === "string" && row.title;
  const hasLegacyVi = typeof row.vi === "string" && row.vi;

  if (!hasTargetTitle && !hasLegacyTitle) {
    errors.push({
      path: `${prefix}.targetTitle`,
      reason:
        "required field missing. Provide targetTitle or legacy title alias.",
      expected: "string",
    });
  }

  if (!hasLearnerTitle && !hasLegacyVi) {
    errors.push({
      path: `${prefix}.learnerTitle`,
      reason:
        "required field missing. Provide learnerTitle or legacy vi alias.",
      expected: "string",
    });
  }

  // objective
  if (typeof row.objective !== "string") {
    errors.push({
      path: `${prefix}.objective`,
      reason: "required field missing",
      expected: "string",
    });
  }

  // required arrays
  const requiredArrays = [
    "vocabulary",
    "grammar",
    "listening",
    "speaking",
  ] as const;
  for (const field of requiredArrays) {
    if (!Array.isArray(row[field])) {
      errors.push({
        path: `${prefix}.${field}`,
        reason: "required field must be an array",
        expected: "array",
      });
    }
  }

  // Validate vocabulary items if array
  if (Array.isArray(row.vocabulary)) {
    for (let vi = 0; vi < row.vocabulary.length; vi++) {
      const vocab = row.vocabulary[vi] as Record<string, unknown> | null;
      if (!vocab || typeof vocab !== "object") {
        errors.push({
          path: `${prefix}.vocabulary[${vi}]`,
          reason: "must be an object",
        });
        continue;
      }
      if (typeof vocab.id !== "string") {
        errors.push({
          path: `${prefix}.vocabulary[${vi}].id`,
          reason: "required field missing",
          expected: "string",
        });
      }
      const hasTarget =
        (typeof vocab.targetText === "string" && vocab.targetText) ||
        (typeof vocab.ko === "string" && vocab.ko);
      const hasLearner =
        (typeof vocab.learnerMeaning === "string" && vocab.learnerMeaning) ||
        (typeof vocab.vi === "string" && vocab.vi);
      if (!hasTarget) {
        errors.push({
          path: `${prefix}.vocabulary[${vi}].targetText`,
          reason:
            "required field missing. Provide targetText or legacy ko alias.",
          expected: "string",
        });
      }
      if (!hasLearner) {
        errors.push({
          path: `${prefix}.vocabulary[${vi}].learnerMeaning`,
          reason:
            "required field missing. Provide learnerMeaning or legacy vi alias.",
          expected: "string",
        });
      }
    }
  }

  // Validate grammar items if array
  if (Array.isArray(row.grammar)) {
    for (let gi = 0; gi < row.grammar.length; gi++) {
      const gram = row.grammar[gi] as Record<string, unknown> | null;
      if (!gram || typeof gram !== "object") {
        errors.push({
          path: `${prefix}.grammar[${gi}]`,
          reason: "must be an object",
        });
        continue;
      }
      for (const field of ["id", "pattern", "meaning", "explanation"]) {
        if (typeof gram[field] !== "string") {
          errors.push({
            path: `${prefix}.grammar[${gi}].${field}`,
            reason: "required field missing",
            expected: "string",
          });
        }
      }
      if (!Array.isArray(gram.examples)) {
        errors.push({
          path: `${prefix}.grammar[${gi}].examples`,
          reason: "required field must be an array",
          expected: "string[]",
        });
      }
    }
  }

  // Validate listening items if array
  if (Array.isArray(row.listening)) {
    for (let li = 0; li < row.listening.length; li++) {
      const item = row.listening[li] as Record<string, unknown> | null;
      if (!item || typeof item !== "object") {
        errors.push({
          path: `${prefix}.listening[${li}]`,
          reason: "must be an object",
        });
        continue;
      }
      for (const field of ["id", "text", "meaning", "answer"]) {
        if (typeof item[field] !== "string") {
          errors.push({
            path: `${prefix}.listening[${li}].${field}`,
            reason: "required field missing",
            expected: "string",
          });
        }
      }
      if (!Array.isArray(item.choices)) {
        errors.push({
          path: `${prefix}.listening[${li}].choices`,
          reason: "required field must be an array",
          expected: "string[]",
        });
      }
    }
  }

  return errors;
}

function validateQuestion(
  value: unknown,
  index: number,
  validLessonIds: Set<number>,
): BundleValidationError[] {
  const errors: BundleValidationError[] = [];
  const prefix = `question[${index}]`;

  if (!value || typeof value !== "object") {
    errors.push({ path: prefix, reason: "must be an object" });
    return errors;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.id !== "string" || !row.id) {
    errors.push({
      path: `${prefix}.id`,
      reason: "required field missing",
      expected: "string",
    });
  }

  const lessonId = Number(row.lessonId);
  if (!Number.isFinite(lessonId)) {
    errors.push({
      path: `${prefix}.lessonId`,
      reason: "must be a finite number",
      expected: "number",
    });
  } else if (validLessonIds.size > 0 && !validLessonIds.has(lessonId)) {
    errors.push({
      path: `${prefix}.lessonId`,
      reason: `lessonId "${lessonId}" referenced by question "${String(row.id ?? index)}" does not exist in bundle lessons`,
      expected: `one of [${Array.from(validLessonIds).join(", ")}]`,
    });
  }

  if (typeof row.skill !== "string" || !VALID_SKILLS.has(row.skill)) {
    errors.push({
      path: `${prefix}.skill`,
      reason: `must be one of: ${Array.from(VALID_SKILLS).join(", ")}`,
      expected: "vocabulary|grammar|listening|speaking|reading|writing",
    });
  }

  if (typeof row.type !== "string" || !VALID_QUESTION_TYPES.has(row.type)) {
    errors.push({
      path: `${prefix}.type`,
      reason: `must be one of: ${Array.from(VALID_QUESTION_TYPES).join(", ")}`,
      expected: "choice|input|reorder",
    });
  }

  if (typeof row.prompt !== "string") {
    errors.push({
      path: `${prefix}.prompt`,
      reason: "required field missing",
      expected: "string",
    });
  }

  if (typeof row.answer !== "string") {
    errors.push({
      path: `${prefix}.answer`,
      reason: "required field missing",
      expected: "string",
    });
  }

  // Type-specific validations
  if (row.type === "choice" && !Array.isArray(row.choices)) {
    errors.push({
      path: `${prefix}.choices`,
      reason: "required for type=choice but missing or not an array",
      expected: "string[]",
    });
  }

  if (
    row.type === "choice" &&
    Array.isArray(row.choices) &&
    typeof row.answer === "string"
  ) {
    if (
      !(row.choices as unknown[]).includes(row.answer) &&
      row.choices.length > 0
    ) {
      errors.push({
        path: `${prefix}.answer`,
        reason: `answer "${row.answer}" is not in the choices array`,
        expected: `one of choices: [${(row.choices as string[]).join(", ")}]`,
      });
    }
  }

  if (row.type === "reorder" && !Array.isArray(row.tokens)) {
    errors.push({
      path: `${prefix}.tokens`,
      reason: "required for type=reorder but missing or not an array",
      expected: "string[]",
    });
  }

  return errors;
}

export class CourseBundleValidationError extends Error {
  public readonly errors: BundleValidationError[];

  constructor(errors: BundleValidationError[]) {
    const summary = errors
      .slice(0, 20)
      .map(
        (e) =>
          `  ${e.path}: ${e.reason}` +
          (e.expected ? ` (expected: ${e.expected})` : ""),
      )
      .join("\n");
    const suffix =
      errors.length > 20
        ? `\n  ... and ${errors.length - 20} more errors`
        : "";
    super(`Course bundle validation failed:\n${summary}${suffix}`);
    this.name = "CourseBundleValidationError";
    this.errors = errors;
  }
}

export function parseCourseBundle(rawText: string): CompiledCourseBundle {
  const parsed = JSON.parse(rawText) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new CourseBundleValidationError([
      { path: "bundle", reason: "must be a JSON object" },
    ]);
  }

  const root = parsed as Record<string, unknown>;
  const rootErrors: BundleValidationError[] = [];

  if (root.format !== COURSE_BUNDLE_FORMAT) {
    rootErrors.push({
      path: "format",
      reason: `must be "${COURSE_BUNDLE_FORMAT}"`,
      expected: COURSE_BUNDLE_FORMAT,
    });
  }

  if (Number(root.version) !== COURSE_BUNDLE_VERSION) {
    rootErrors.push({
      path: "version",
      reason: `unsupported version: ${String(root.version)}`,
      expected: String(COURSE_BUNDLE_VERSION),
    });
  }

  if (!root.course || typeof root.course !== "object") {
    rootErrors.push({
      path: "course",
      reason: "required field missing or not an object",
    });
  }

  if (rootErrors.length) {
    throw new CourseBundleValidationError(rootErrors);
  }

  const course = root.course as Record<string, unknown>;
  const courseErrors: BundleValidationError[] = [];

  if (typeof course.title !== "string") {
    courseErrors.push({
      path: "course.title",
      reason: "required field missing",
      expected: "string",
    });
  }

  if (typeof course.level !== "string") {
    courseErrors.push({
      path: "course.level",
      reason: "required field missing",
      expected: "string",
    });
  }

  if (!Array.isArray(course.lessons)) {
    courseErrors.push({
      path: "course.lessons",
      reason: "required field must be an array",
      expected: "LessonContent[]",
    });
  }

  if (!Array.isArray(course.questions)) {
    courseErrors.push({
      path: "course.questions",
      reason: "required field must be an array",
      expected: "StudyQuestion[]",
    });
  }

  if (courseErrors.length) {
    throw new CourseBundleValidationError(courseErrors);
  }

  // Validate each lesson
  const lessonErrors: BundleValidationError[] = [];
  const lessons = course.lessons as unknown[];
  for (let i = 0; i < lessons.length; i++) {
    lessonErrors.push(...validateLesson(lessons[i], i));
  }

  // Collect valid lesson IDs for question cross-referencing
  const validLessonIds = new Set<number>();
  for (const lesson of lessons) {
    if (lesson && typeof lesson === "object") {
      const id = Number((lesson as Record<string, unknown>).id);
      if (Number.isFinite(id)) {
        validLessonIds.add(id);
      }
    }
  }

  // Validate each question
  const questionErrors: BundleValidationError[] = [];
  const questions = course.questions as unknown[];
  for (let i = 0; i < questions.length; i++) {
    questionErrors.push(
      ...validateQuestion(questions[i], i, validLessonIds),
    );
  }

  const allErrors = [...lessonErrors, ...questionErrors];
  if (allErrors.length) {
    throw new CourseBundleValidationError(allErrors);
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
      title: course.title as string,
      level: course.level as string,
      edition:
        typeof course.edition === "string" ? course.edition : undefined,
      lessons: (course.lessons as unknown[]).map(normalizeLessonContent),
      questions: course.questions as StudyQuestion[],
    },
  };
}

export function serializeCourseBundle(
  bundle: CompiledCourseBundle,
) {
  return JSON.stringify(bundle, null, 2);
}

export function getCompilationContract(language: LanguageProfile) {
  return {
    output: {
      format: COURSE_BUNDLE_FORMAT,
      version: COURSE_BUNDLE_VERSION,
      sourceManifest: "Copy exactly from job.sourceManifest.",
    },
    language,
    principles: [
      "The uploaded textbook is the curriculum source of truth.",
      "Preserve lesson order and source page references.",
      "Cover vocabulary, grammar, dialogue, pronunciation, culture, notes, exercises and special sections when present.",
      "Create practice for vocabulary, grammar, listening, speaking, reading and writing without introducing unsupported curriculum.",
      "Derived exercises must be grounded only in knowledge from the same lesson and mark sourceRef as Derived from <source pages>.",
      "Do not invent unreadable source content; record uncertainty instead.",
      "Keep the compiler language-neutral. Use job.language instead of assuming Korean, Vietnamese, English, or Chinese.",
      "For vocabulary prefer targetText and learnerMeaning. For dialogue lines prefer targetText and learnerMeaning. Legacy ko/vi aliases are accepted and normalized automatically.",
      "During long lessons, call save_work_checkpoint after meaningful source-reading chunks and before long drafting or QA work so the exact page cursor and partial state survive interruption.",
      "After finishing and checking each lesson, call save_lesson_draft immediately. Saving the lesson clears its mid-lesson work checkpoint.",
      "Before source reading in any new or resumed run, call get_compilation_progress. Resume activeWork from its sourceCursor/phase, skip completedLessonIds, and never restart verified work unless deliberate correction is required.",
      "Use finalize_course_bundle after all real textbook lessons are checkpointed. Detected lesson candidates are hints and may contain false positives.",
    ],
    checkpointWorkflow: [
      "get_compilation_progress",
      "resume activeWork if present",
      "read_import_pages for the unfinished source range",
      "save_work_checkpoint after meaningful chunks",
      "compile and QA that lesson",
      "save_lesson_draft",
      "repeat only for unfinished lessons",
      "finalize_course_bundle",
    ],
    runtimeSchema: {
      course: {
        title: "string",
        level: "string",
        edition: "string optional",
        lessons: "LessonContent[]",
        questions: "StudyQuestion[]",
      },
      LessonContent: {
        id: "number",
        targetTitle: "string preferred",
        learnerTitle: "string preferred",
        title: "string legacy alias accepted",
        vi: "string legacy alias accepted",
        objective: "string",
        vocabulary: [
          {
            id: "string",
            targetText: "string preferred",
            learnerMeaning: "string preferred",
            ko: "string legacy alias accepted",
            vi: "string legacy alias accepted",
            example: "string",
            sourceRef: "string optional",
          },
        ],
        grammar: [
          {
            id: "string",
            pattern: "string",
            meaning: "string",
            explanation: "string",
            examples: "string[]",
            sourceRef: "string optional",
          },
        ],
        listening: [
          {
            id: "string",
            text: "string",
            meaning: "string",
            choices: "string[]",
            answer: "string",
            sourceRef: "string optional",
          },
        ],
        speaking: "string[]",
        reading: {
          title: "string",
          text: "string",
          translation: "string",
          questions:
            "{id:string,q:string,choices:string[],answer:string,sourceRef?:string}[]",
          sourceRef: "string optional",
        },
        writing: {
          prompt: "string",
          hint: "string",
          targetWords: "string[]",
          sourceRef: "string optional",
        },
        dialogues:
          "{id:string,title?:string,lines:{speaker?:string,targetText?:string,learnerMeaning?:string,ko?:string,vi?:string}[],sourceRef?:string}[] optional",
        pronunciation:
          "{id:string,title:string,explanation:string,examples:string[],sourceRef?:string}[] optional",
        culture:
          "{id:string,title:string,text:string,sourceRef?:string}[] optional",
        extraSections:
          "{id:string,kind:string,title:string,content:string[],sourceRef?:string}[] optional",
        media: "LessonMedia[] optional",
        sourceRef: "string optional",
        quality:
          "{coverageScore:number,groundingScore:number,issues:string[],missingTopics:string[]} optional",
      },
      StudyQuestion: {
        id: "string",
        lessonId: "number",
        skill:
          "vocabulary|grammar|listening|speaking|reading|writing",
        type: "choice|input|reorder",
        title: "string",
        prompt: "string",
        translation: "string optional",
        choices: "string[] optional",
        tokens: "string[] optional",
        answer: "string",
        explanation: "string",
        sourceRef: "string optional",
      },
      requiredLessonFields: [
        "id",
        "objective",
        "vocabulary",
        "grammar",
        "listening",
        "speaking",
      ],
      titleRule:
        "Each lesson must provide targetTitle+learnerTitle or legacy title+vi.",
      requiredQuestionFields: [
        "id",
        "lessonId",
        "skill",
        "type",
        "prompt",
        "answer",
      ],
    },
    runtimeCompatibility: {
      note:
        "Runtime v1 still exposes legacy aliases such as vocabulary.ko and vocabulary.vi to older UI components. Bundle parsing now normalizes canonical targetText/learnerMeaning and targetTitle/learnerTitle into those aliases, so new language profiles do not require changing the MCP protocol.",
    },
  };
}


