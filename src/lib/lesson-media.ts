import type { LessonMedia } from "@/data/content";
import type { ExtractedPage } from "@/lib/pdf-extractor";

function mediaTypeFromUrl(url: string): LessonMedia["type"] {
  if (/youtube|youtu\.be|vimeo|\.mp4(?:$|\?)|\.webm(?:$|\?)/i.test(url)) {
    return "video";
  }
  if (/\.mp3(?:$|\?)|\.wav(?:$|\?)|\.m4a(?:$|\?)/i.test(url)) {
    return "audio";
  }
  if (/\.(?:png|jpe?g|webp|gif)(?:$|\?)/i.test(url)) {
    return "image";
  }
  return "document";
}

function safePageId(fileName: string, pageNumber: number) {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) +
    "-p" +
    pageNumber
  );
}

export function buildLessonMedia(pages: ExtractedPage[]): LessonMedia[] {
  const media: LessonMedia[] = [];

  for (const page of pages) {
    const baseId = safePageId(page.fileName, page.pageNumber);
    const sourceRef = page.fileName + " · p." + page.pageNumber;

    page.embeddedImages.forEach((image, index) => {
      media.push({
        id: "pdf-image-" + baseId + "-" + index,
        type: "image",
        role: "illustration",
        src: image.dataUrl,
        alt: sourceRef,
        caption: page.text.slice(0, 180) || undefined,
        sourceRef,
        fileName: page.fileName,
        pageNumber: page.pageNumber,
      });
    });

    if (page.previewImageDataUrl) {
      media.push({
        id: "pdf-page-" + baseId,
        type: "image",
        role: "source-page",
        src: page.previewImageDataUrl,
        alt: sourceRef,
        caption: page.text.slice(0, 180) || undefined,
        sourceRef,
        fileName: page.fileName,
        pageNumber: page.pageNumber,
      });
    }

    page.externalLinks.forEach((url, index) => {
      const type = mediaTypeFromUrl(url);
      media.push({
        id: "pdf-link-" + baseId + "-" + index,
        type,
        role: "external",
        src: url,
        alt: sourceRef,
        sourceRef,
        fileName: page.fileName,
        pageNumber: page.pageNumber,
      });
    });
  }

  const priority = (item: LessonMedia) => {
    if (item.type === "video") return 0;
    if (item.type === "audio") return 1;
    if (item.role === "illustration") return 2;
    if (item.role === "source-page") return 3;
    return 4;
  };

  return media.sort((a, b) => priority(a) - priority(b));
}
