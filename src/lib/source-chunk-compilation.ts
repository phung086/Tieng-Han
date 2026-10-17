import type { LessonContent, StudyQuestion } from "@/data/content";
import { parseCourseBundle } from "@/lib/course-bundle";

export type SourcePageSlice = {
  fileName: string;
  pageNumber: number;
  text: string;
  imageDataUrl?: string;
  sourceLocation?: string;
  part?: number;
};

const label = (page: SourcePageSlice) =>
  "[SOURCE: " + page.fileName + " · " + (page.sourceLocation ?? "p." + page.pageNumber) +
  (page.part ? " · part " + page.part : "") + "]\n";

/** Preserve every source character; never silently skip pages at a character limit. */
export function chunkSourcePages(
  pages: SourcePageSlice[],
  maxCharacters = 45_000,
  maxVisualPages = 8,
): SourcePageSlice[][] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 500) {
    throw new Error("Source character budget must be an integer >= 500");
  }
  if (!Number.isInteger(maxVisualPages) || maxVisualPages < 1) {
    throw new Error("Visual page budget must be >= 1");
  }
  const output: SourcePageSlice[][] = [];
  let current: SourcePageSlice[] = [];
  let length = 0;
  let images = 0;

  const flush = () => {
    if (current.length) output.push(current);
    current = [];
    length = 0;
    images = 0;
  };

  for (const page of pages) {
    const text = typeof page.text === "string" ? page.text : "";
    let cursor = 0;
    let part = 0;
    // Each page is represented even if its extracted text is empty.
    do {
      part++;
      const partLabel = label({ ...page, part });
      const capacity = maxCharacters - partLabel.length - 2;
      if (capacity < 1) throw new Error("Source page filename exceeds the character budget");
      const piece = text.slice(cursor, cursor + capacity);
      const segment: SourcePageSlice = {
        ...page,
        text: piece,
        part: part > 1 || text.length > capacity ? part : undefined,
      };
      const amount = label(segment).length + segment.text.length + 2;
      if (current.length && (
        length + amount > maxCharacters ||
        (page.imageDataUrl && images >= maxVisualPages)
      )) flush();
      current.push(segment);
      length += amount;
      if (segment.imageDataUrl) images++;
      cursor += piece.length;
    } while (cursor < text.length);
  }
  flush();
  return output;
}

export function formatSourcePages(pages: SourcePageSlice[]): string {
  return pages.map(page => label(page) + page.text + "\n\n").join("");
}

type GeneratedChunk = { lesson: LessonContent; questions: StudyQuestion[] };
const unique = (items: string[]) => [...new Set(items.map(x => x.trim()).filter(Boolean))];

function idPrefix<T extends { id: string }>(items: T[], chunk: number): T[] {
  return items.map((item, index) => ({
    ...item,
    id: "chunk" + (chunk + 1) + ":" + (item.id || index + 1),
  }));
}

/**
 * The published bundle still uses the same LessonContent / StudyQuestion v1
 * shape. Extra passages or writing tasks that cannot fit the single-field v1
 * schema are retained verbatim in extraSections, not lost.
 */
export function mergeGeneratedLessonChunks(
  lessonId: number,
  values: unknown[],
): GeneratedChunk {
  if (!values.length) throw new Error("No source chunks were compiled");
  const chunks = values.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Invalid generated chunk " + (index + 1));
    }
    const raw = value as Record<string, unknown>;
    if (!raw.lesson || typeof raw.lesson !== "object" || Array.isArray(raw.lesson)) {
      throw new Error("Generated chunk " + (index + 1) + " has no lesson");
    }
    if (!Array.isArray(raw.questions)) {
      throw new Error("Generated chunk " + (index + 1) + " has no question array");
    }
    const parsed = parseCourseBundle(JSON.stringify({
      format: "haneul-course-bundle", version: 1,
      course: { title: "Source batch " + (index + 1), level: "",
        lessons: [{ ...(raw.lesson as Record<string, unknown>), id: lessonId }],
        questions: raw.questions.map(question => question && typeof question === "object"
          ? { ...question, lessonId } : question),
      },
    }));
    return { lesson: parsed.course.lessons[0], questions: parsed.course.questions };
  });

  const first = chunks[0].lesson;
  const primaryReadingChunk = chunks.findIndex(chunk => Boolean(chunk.lesson.reading));
  const primaryWritingChunk = chunks.findIndex(chunk => Boolean(chunk.lesson.writing));
  const extraSections: NonNullable<LessonContent["extraSections"]> = [];
  const vocabulary: LessonContent["vocabulary"] = [];
  const grammar: LessonContent["grammar"] = [];
  const listening: LessonContent["listening"] = [];
  const speaking: string[] = [];
  const dialogues: NonNullable<LessonContent["dialogues"]> = [];
  const pronunciation: NonNullable<LessonContent["pronunciation"]> = [];
  const culture: NonNullable<LessonContent["culture"]> = [];
  const media: NonNullable<LessonContent["media"]> = [];
  const questions: StudyQuestion[] = [];

  chunks.forEach((chunk, index) => {
    const lesson = chunk.lesson;
    vocabulary.push(...idPrefix(lesson.vocabulary ?? [], index));
    grammar.push(...idPrefix(lesson.grammar ?? [], index));
    listening.push(...idPrefix(lesson.listening ?? [], index));
    speaking.push(...(lesson.speaking ?? []));
    dialogues.push(...idPrefix(lesson.dialogues ?? [], index));
    pronunciation.push(...idPrefix(lesson.pronunciation ?? [], index));
    culture.push(...idPrefix(lesson.culture ?? [], index));
    media.push(...idPrefix(lesson.media ?? [], index));
    extraSections.push(...idPrefix(lesson.extraSections ?? [], index));

    if (index !== primaryReadingChunk && lesson.reading) {
      extraSections.push({
        id: "chunk" + (index + 1) + ":reading",
        kind: "reading",
        title: lesson.reading.title || "Bài đọc tiếp theo",
        content: [
          lesson.reading.text,
          lesson.reading.translation,
          ...lesson.reading.questions.flatMap(q => [
            q.q,
            ...(q.choices ?? []),
            ...(q.answer ? ["Đáp án nguồn: " + q.answer] : []),
          ]),
        ].filter(Boolean),
        sourceRef: lesson.reading.sourceRef || lesson.sourceRef,
      });
    }
    if (index !== primaryWritingChunk && lesson.writing) {
      extraSections.push({
        id: "chunk" + (index + 1) + ":writing",
        kind: "writing",
        title: "Nhiệm vụ viết · phần " + (index + 1),
        content: [
          lesson.writing.prompt,
          lesson.writing.hint,
          ...lesson.writing.targetWords,
        ].filter(Boolean),
        sourceRef: lesson.writing.sourceRef || lesson.sourceRef,
      });
    }
    questions.push(...chunk.questions.map((q, j) => ({
      ...q,
      lessonId,
      id: "chunk" + (index + 1) + ":" + (q.id || j + 1),
    })));
  });

  return {
    lesson: {
      ...first,
      id: lessonId,
      vocabulary,
      grammar,
      listening,
      speaking,
      dialogues,
      pronunciation,
      culture,
      extraSections,
      media,
      // Preserve every section; the first passage remains in the native reading field.
      reading: primaryReadingChunk < 0 ? null : chunks[primaryReadingChunk].lesson.reading,
      writing: primaryWritingChunk < 0 ? null : chunks[primaryWritingChunk].lesson.writing,
      objective: unique(chunks.map(x => x.lesson.objective)).join(" · "),
    },
    questions,
  };
}
