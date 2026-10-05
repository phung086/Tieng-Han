"use client";

import { ingestionConfig } from "@/config/ingestion";

export type EmbeddedPdfImage = {
  id: string;
  width: number;
  height: number;
  dataUrl: string;
};

export type ExtractedPage = {
  documentId: string;
  fileName: string;
  pageNumber: number;
  text: string;
  hasVisual: boolean;
  previewImageDataUrl?: string;
  embeddedImages: EmbeddedPdfImage[];
  externalLinks: string[];
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

type PdfImageLike = {
  width?: number;
  height?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
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

  return {
    pdfjs,
    pdf: await pdfjs.getDocument({ data }).promise,
  };
}

type LoadedPdf = Awaited<ReturnType<typeof loadPdf>>;
type PdfPage = Awaited<ReturnType<LoadedPdf["pdf"]["getPage"]>>;
type PdfOperatorList = Awaited<ReturnType<PdfPage["getOperatorList"]>>;

async function renderPagePreview(
  page: PdfPage,
  scale = ingestionConfig.pdf.previewScale,
) {
  const baseViewport = page.getViewport({ scale });
  const widthScale =
    baseViewport.width > ingestionConfig.pdf.maxPreviewWidth
      ? ingestionConfig.pdf.maxPreviewWidth / baseViewport.width
      : 1;
  const viewport = page.getViewport({ scale: scale * widthScale });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Trình duyệt không tạo được canvas để render PDF.");
  }

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL(
    "image/jpeg",
    ingestionConfig.pdf.previewJpegQuality,
  );
}

function rawPixelsToDataUrl(image: PdfImageLike) {
  const width = Number(image.width);
  const height = Number(image.height);
  const data = image.data;

  if (!width || !height || !data) return null;

  const pixelCount = width * height;
  if (pixelCount < ingestionConfig.pdf.minEmbeddedImagePixels) return null;

  let rgba: Uint8ClampedArray;

  if (data.length === pixelCount * 4) {
    rgba = new Uint8ClampedArray(data);
  } else if (data.length === pixelCount * 3) {
    rgba = new Uint8ClampedArray(pixelCount * 4);
    for (let source = 0, target = 0; source < data.length; source += 3, target += 4) {
      rgba[target] = data[source];
      rgba[target + 1] = data[source + 1];
      rgba[target + 2] = data[source + 2];
      rgba[target + 3] = 255;
    }
  } else {
    return null;
  }

  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.putImageData(new ImageData(rgba, width, height), 0, 0);

  return {
    width,
    height,
    dataUrl: canvas.toDataURL(
      "image/jpeg",
      ingestionConfig.pdf.previewJpegQuality,
    ),
  };
}

function drawableToDataUrl(value: unknown) {
  if (typeof window === "undefined") return null;

  if (
    (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) ||
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLImageElement
  ) {
    const drawable = value as CanvasImageSource & {
      width: number;
      height: number;
    };
    const width = Number(drawable.width);
    const height = Number(drawable.height);

    if (
      !width ||
      !height ||
      width * height < ingestionConfig.pdf.minEmbeddedImagePixels
    ) {
      return null;
    }

    const canvas = window.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(drawable, 0, 0);

    return {
      width,
      height,
      dataUrl: canvas.toDataURL(
        "image/jpeg",
        ingestionConfig.pdf.previewJpegQuality,
      ),
    };
  }

  if (value && typeof value === "object") {
    const image = value as PdfImageLike;

    if (image.bitmap && typeof ImageBitmap !== "undefined") {
      return drawableToDataUrl(image.bitmap);
    }

    return rawPixelsToDataUrl(image);
  }

  return null;
}

function readPdfObject(page: PdfPage, objectId: string) {
  const objects = page.objs as unknown as {
    get: (id: string) => unknown;
  };

  try {
    return objects.get(objectId);
  } catch {
    return null;
  }
}

function extractEmbeddedImages(
  page: PdfPage,
  operatorList: PdfOperatorList,
  imageOps: Set<number>,
) {
  const items: EmbeddedPdfImage[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    if (!imageOps.has(operatorList.fnArray[index])) continue;

    const args = operatorList.argsArray[index] as unknown[];
    const firstArg = args?.[0];
    let source: unknown = firstArg;
    let sourceId = "inline-" + index;

    if (typeof firstArg === "string") {
      sourceId = firstArg;
      if (seen.has(sourceId)) continue;
      source = readPdfObject(page, firstArg);
    }

    const rendered = drawableToDataUrl(source);
    if (!rendered) continue;

    seen.add(sourceId);
    items.push({
      id: sourceId,
      width: rendered.width,
      height: rendered.height,
      dataUrl: rendered.dataUrl,
    });

    if (items.length >= ingestionConfig.pdf.maxEmbeddedImagesPerPage) {
      break;
    }
  }

  return items;
}

function extractAnnotationLinks(
  annotations: Awaited<ReturnType<PdfPage["getAnnotations"]>>,
) {
  const urls = annotations
    .map((annotation) => {
      if ("url" in annotation && typeof annotation.url === "string") {
        return annotation.url;
      }
      if (
        "unsafeUrl" in annotation &&
        typeof annotation.unsafeUrl === "string"
      ) {
        return annotation.unsafeUrl;
      }
      return "";
    })
    .filter(Boolean);

  return [...new Set(urls)];
}

export async function extractPdf(
  file: File,
  documentIndex: number,
): Promise<ExtractedDocument> {
  const { pdf, pdfjs } = await loadPdf(file);
  const id = "doc-" + documentIndex;
  const pages: ExtractedPage[] = [];
  const imageOps = new Set<number>([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
    pdfjs.OPS.paintSolidColorImageMask,
  ]);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const [textContent, operatorList, annotations] = await Promise.all([
      page.getTextContent(),
      page.getOperatorList(),
      page.getAnnotations({ intent: "display" }),
    ]);

    const lines = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    const externalLinks = extractAnnotationLinks(annotations);
    const hasRasterVisual = operatorList.fnArray.some((operation) =>
      imageOps.has(operation),
    );
    const hasVisual =
      hasRasterVisual ||
      externalLinks.some((url) =>
        /youtube|youtu\.be|vimeo|video|mp4|webm/i.test(url),
      );

    let previewImageDataUrl: string | undefined;
    let embeddedImages: EmbeddedPdfImage[] = [];

    if (hasVisual) {
      try {
        previewImageDataUrl = await renderPagePreview(page);
        embeddedImages = extractEmbeddedImages(page, operatorList, imageOps);
      } catch {
        // Text ingestion remains usable if visual extraction is unsupported.
      }
    }

    pages.push({
      documentId: id,
      fileName: file.name,
      pageNumber,
      text: cleanPageText(lines),
      hasVisual,
      previewImageDataUrl,
      embeddedImages,
      externalLinks,
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
  const low = document.pages.filter(
    (page) => page.text.length < ingestionConfig.pdf.lowTextCharacters,
  ).length;
  return low / document.pages.length;
}

export async function ocrLowTextPages(
  file: File,
  extracted: ExtractedDocument,
  onProgress?: (completed: number, total: number) => void,
) {
  const targets = extracted.pages.filter(
    (page) => page.text.length < ingestionConfig.pdf.lowTextCharacters,
  );
  if (!targets.length) return extracted;

  const { pdf } = await loadPdf(file);
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
      const imageDataUrl =
        target.previewImageDataUrl ??
        (await renderPagePreview(page, 1.35));

      images.push({
        fileName: file.name,
        pageNumber: target.pageNumber,
        imageDataUrl,
      });

      const storedPage = pages.find(
        (item) => item.pageNumber === target.pageNumber,
      );
      if (storedPage && !storedPage.previewImageDataUrl) {
        storedPage.previewImageDataUrl = imageDataUrl;
      }
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
    /(?:bài|lesson|unit)\s*(\d{1,2})\b/gi,
    /(?:제\s*)?(\d{1,2})\s*과\b/g,
    /과\s*(\d{1,2})\b/g,
  ];

  for (const page of document.pages) {
    const head = page.text.slice(0, 1600);
    const candidates: Array<{ lessonId: number; index: number }> = [];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of head.matchAll(pattern)) {
        const lessonId = Number(match[1]);
        if (!Number.isFinite(lessonId) || lessonId < 1 || lessonId > 99) continue;
        candidates.push({ lessonId, index: match.index ?? 0 });
      }
    }

    const uniqueIds = [...new Set(candidates.map((item) => item.lessonId))];

    if (uniqueIds.length !== 1) continue;

    const lessonId = uniqueIds[0];
    if (starts.some((item) => item.lessonId === lessonId)) continue;

    const first = candidates
      .filter((item) => item.lessonId === lessonId)
      .sort((a, b) => a.index - b.index)[0];

    starts.push({
      lessonId,
      pageNumber: page.pageNumber,
      titleHint: head.slice(
        Math.max(0, first.index),
        Math.min(head.length, first.index + 140),
      ),
    });
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
