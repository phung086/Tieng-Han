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

function safeSliceEnd(text: string, start: number, requestedEnd: number): number {
  const end = Math.min(requestedEnd, text.length);
  if (end > start && end < text.length) {
    const previous = text.charCodeAt(end - 1);
    const next = text.charCodeAt(end);
    const splitsSurrogatePair =
      previous >= 0xd800 && previous <= 0xdbff &&
      next >= 0xdc00 && next <= 0xdfff;
    if (splitsSurrogatePair) return end - 1;
  }
  return end;
}

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
      const end = safeSliceEnd(text, cursor, cursor + capacity);
      if (end <= cursor) {
        throw new Error("Source character budget cannot fit a Unicode code point");
      }
      const piece = text.slice(cursor, end);
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

/** Keep the entire extracted source as a separately labelled fallback, never as
 * evidence that the model has authored or verified every knowledge unit. */
export function retainSourceTranscripts(lessonId: number, value: unknown, pages: SourcePageSlice[]): GeneratedChunk {
  const parsed = mergeGeneratedLessonChunks(lessonId, [value]);
  const existing = parsed.lesson.extraSections ?? [];
  parsed.lesson.extraSections = [...existing, ...pages.map((page, index) => ({
    id: "source-transcript:" + index,
    kind: "source-transcript",
    title: "Bản trích xuất nguyên trang · " + (page.sourceLocation ?? "trang PDF " + page.pageNumber) + (page.part ? " · phần " + page.part : ""),
    content: [page.text || "Trang không có văn bản trích xuất; cần đối chiếu ảnh nguồn."],
    sourceRef: page.fileName + " · " + (page.sourceLocation ?? "p." + page.pageNumber) + (page.part ? " · part " + page.part : ""),
  }))];
  return parsed;
}
const unique = (items: string[]) => [...new Set(items.map(x => x.trim()).filter(Boolean))];

function idPrefix<T extends { id: string }>(items: T[], chunk: number): T[] {
  return items.map((item, index) => ({
    ...item,
    id: "chunk" + (chunk + 1) + ":" + (item.id || index + 1),
  }));
}

function addExtraSectionItem(
  sections: NonNullable<LessonContent["extraSections"]>,
  item: { id: string; kind: string; title: string; value: string; sourceRef?: string },
) {
  if (!item.value) return;
  const sourceRef =
    typeof item.sourceRef === "string" && item.sourceRef.trim()
      ? item.sourceRef
      : undefined;
  sections.push({
    id: item.id,
    kind: item.kind,
    title: item.title,
    content: [item.value],
    ...(sourceRef ? { sourceRef } : {}),
  });
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
  const speakingSourceRefs: NonNullable<LessonContent["speakingSourceRefs"]> = [];
  const hasSpeakingSourceRefs = chunks.some(chunk => chunk.lesson.speakingSourceRefs !== undefined);
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
    if (hasSpeakingSourceRefs) {
      // Chunks compiled before item-level refs remain visible but unverified.
      // Keep a 1:1 alignment across the merged speaking list.
      speakingSourceRefs.push(...(lesson.speakingSourceRefs ?? (lesson.speaking ?? []).map(() => null)));
    }
    dialogues.push(...idPrefix(lesson.dialogues ?? [], index));
    pronunciation.push(...idPrefix(lesson.pronunciation ?? [], index));
    culture.push(...idPrefix(lesson.culture ?? [], index));
    media.push(...idPrefix(lesson.media ?? [], index));
    extraSections.push(...idPrefix(lesson.extraSections ?? [], index));

    if (index !== primaryReadingChunk && lesson.reading) {
      // The v1 reading/extra-section references are additive. Read newer item
      // refs when present, but never treat a section/lesson ref as child evidence.
      const reading = lesson.reading as Omit<NonNullable<LessonContent["reading"]>, "questions"> & {
        titleSourceRef?: string;
        textSourceRef?: string;
        questions: Array<{
          id: string;
          q: string;
          choices: string[];
          answer: string;
          sourceRef?: string;
          choiceSourceRefs?: string[];
        }>;
      };
      const chunkPrefix = "chunk" + (index + 1) + ":reading";
      const readingTitle = reading.title || "Bài đọc tiếp theo";
      if (reading.titleSourceRef) {
        addExtraSectionItem(extraSections, {
          id: chunkPrefix + ":title",
          kind: "reading-title",
          title: "Tiêu đề nguồn · " + readingTitle,
          value: reading.title,
          sourceRef: reading.titleSourceRef,
        });
      }
      addExtraSectionItem(extraSections, {
        id: chunkPrefix + ":passage",
        kind: "reading",
        title: readingTitle,
        value: reading.text,
        sourceRef: reading.textSourceRef,
      });
      addExtraSectionItem(extraSections, {
        id: chunkPrefix + ":translation",
        kind: "reading-translation",
        title: "Bản dịch · " + readingTitle,
        value: reading.translation,
      });
      reading.questions.forEach((question, questionIndex) => {
        const questionKey = question.id || String(questionIndex + 1);
        const questionPrefix = chunkPrefix + ":question:" + questionKey;
        addExtraSectionItem(extraSections, {
          id: questionPrefix,
          kind: "reading-question",
          title: "Câu hỏi đọc hiểu · " + (questionIndex + 1),
          value: question.q,
          sourceRef: question.sourceRef,
        });
        (question.choices ?? []).forEach((choice, choiceIndex) => {
          addExtraSectionItem(extraSections, {
            id: questionPrefix + ":choice:" + (choiceIndex + 1),
            kind: "reading-choice",
            title: "Lựa chọn " + (choiceIndex + 1) + " · câu hỏi " + (questionIndex + 1),
            value: choice,
            sourceRef: question.choiceSourceRefs?.[choiceIndex],
          });
        });
        addExtraSectionItem(extraSections, {
          id: questionPrefix + ":answer",
          kind: "reading-answer",
          title: "Đáp án gốc · câu hỏi " + (questionIndex + 1),
          value: question.answer,
        });
      });
    }
    if (index !== primaryWritingChunk && lesson.writing) {
      // Keep prompt, hint and target words separately addressable. A writing
      // section ref is not sufficient evidence for any of these child items.
      const writing = lesson.writing as NonNullable<LessonContent["writing"]> & {
        promptSourceRef?: string;
        targetWordSourceRefs?: string[];
      };
      const chunkPrefix = "chunk" + (index + 1) + ":writing";
      addExtraSectionItem(extraSections, {
        id: chunkPrefix + ":prompt",
        kind: "writing",
        title: "Nhiệm vụ viết · phần " + (index + 1),
        value: writing.prompt,
        sourceRef: writing.promptSourceRef,
      });
      addExtraSectionItem(extraSections, {
        id: chunkPrefix + ":hint",
        kind: "writing-hint",
        title: "Gợi ý viết · phần " + (index + 1),
        value: writing.hint,
      });
      writing.targetWords.forEach((word, wordIndex) => {
        addExtraSectionItem(extraSections, {
          id: chunkPrefix + ":target-word:" + (wordIndex + 1),
          kind: "writing-target-word",
          title: "Từ mục tiêu · phần " + (index + 1) + " · " + (wordIndex + 1),
          value: word,
          sourceRef: writing.targetWordSourceRefs?.[wordIndex],
        });
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
      speakingSourceRefs: hasSpeakingSourceRefs ? speakingSourceRefs : undefined,
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
