"use client";

export type ExtractedPage = {
  documentId: string;
  fileName: string;
  pageNumber: number;
  text: string;
};

export type ExtractedDocument = {
  id: string;
  fileName: string;
  pageCount: number;
  pages: ExtractedPage[];
};

function cleanPageText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(file: File, documentIndex: number): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const id = "doc-" + documentIndex;

  const pages: ExtractedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const lines = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    pages.push({
      documentId: id,
      fileName: file.name,
      pageNumber,
      text: cleanPageText(lines),
    });
  }

  return {
    id,
    fileName: file.name,
    pageCount: pdf.numPages,
    pages,
  };
}

export function localLessonStarts(document: ExtractedDocument) {
  const starts: { lessonId: number; pageNumber: number; titleHint: string }[] = [];
  const patterns = [
    /(?:^|\s)(?:bài|lesson|unit)\s*(\d{1,2})\b/i,
    /(?:^|\s)(?:제\s*)?(\d{1,2})\s*과\b/,
    /(?:^|\s)과\s*(\d{1,2})\b/,
  ];

  for (const page of document.pages) {
    const head = page.text.slice(0, 1200);
    for (const pattern of patterns) {
      const match = head.match(pattern);
      if (!match) continue;

      const lessonId = Number(match[1]);
      if (!Number.isFinite(lessonId) || lessonId < 1 || lessonId > 99) continue;

      if (!starts.some((item) => item.lessonId === lessonId)) {
        starts.push({
          lessonId,
          pageNumber: page.pageNumber,
          titleHint: head.slice(Math.max(0, match.index ?? 0), Math.min(head.length, (match.index ?? 0) + 120)),
        });
      }
      break;
    }
  }

  return starts.sort((a, b) => a.lessonId - b.lessonId);
}

export function pagesForLesson(
  document: ExtractedDocument,
  starts: { lessonId: number; pageNumber: number }[],
  lessonId: number,
) {
  const index = starts.findIndex((item) => item.lessonId === lessonId);
  if (index < 0) return [];

  const start = starts[index].pageNumber;
  const end = starts[index + 1]?.pageNumber
    ? starts[index + 1].pageNumber - 1
    : document.pageCount;

  return document.pages.filter(
    (page) => page.pageNumber >= start && page.pageNumber <= end,
  );
}
