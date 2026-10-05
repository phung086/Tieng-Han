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

type OcrResponse = {
  pages?: Array<{ pageNumber: number; text: string }>;
  error?: string;
};

function cleanPageText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

export async function extractPdf(
  file: File,
  documentIndex: number,
): Promise<ExtractedDocument> {
  const pdf = await loadPdf(file);
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

export function lowTextRatio(document: ExtractedDocument) {
  if (!document.pages.length) return 1;
  const low = document.pages.filter((page) => page.text.length < 80).length;
  return low / document.pages.length;
}

export async function ocrLowTextPages(
  file: File,
  extracted: ExtractedDocument,
  onProgress?: (completed: number, total: number) => void,
) {
  const targets = extracted.pages.filter((page) => page.text.length < 80);
  if (!targets.length) return extracted;

  const pdf = await loadPdf(file);
  const pages = extracted.pages.map((page) => ({ ...page }));
  const batchSize = 3;
  let completed = 0;

  for (let offset = 0; offset < targets.length; offset += batchSize) {
    const batchTargets = targets.slice(offset, offset + batchSize);
    const images: Array<{
      fileName: string;
      pageNumber: number;
      imageDataUrl: string;
    }> = [];

    for (const target of batchTargets) {
      const page = await pdf.getPage(target.pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Trình duyệt không tạo được canvas để OCR.");

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      images.push({
        fileName: file.name,
        pageNumber: target.pageNumber,
        imageDataUrl: canvas.toDataURL("image/jpeg", 0.72),
      });
    }

    const response = await fetch("/api/ingest/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages: images }),
    });

    const result = (await response.json()) as OcrResponse;
    if (!response.ok) {
      throw new Error(result.error || "OCR vision thất bại.");
    }

    for (const ocrPage of result.pages ?? []) {
      const page = pages.find((item) => item.pageNumber === ocrPage.pageNumber);
      if (page && ocrPage.text.trim()) {
        page.text = cleanPageText(ocrPage.text);
      }
    }

    completed += batchTargets.length;
    onProgress?.(completed, targets.length);
  }

  return {
    ...extracted,
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
          titleHint: head.slice(
            Math.max(0, match.index ?? 0),
            Math.min(head.length, (match.index ?? 0) + 120),
          ),
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
