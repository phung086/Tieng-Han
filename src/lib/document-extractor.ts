"use client";

import { extractPdf, type ExtractedDocument, type ExtractedPage } from "@/lib/pdf-extractor";

function blockText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.tagName === "BR") return "\n";
  const text = Array.from(node.childNodes).map(blockText).join("");
  if (node.tagName === "TD" || node.tagName === "TH") return text + "\t";
  return /^(P|H[1-6]|LI|TR|TABLE|UL|OL)$/.test(node.tagName) ? text + "\n" : text;
}

/** DOCX has no reliable physical pagination without a Word layout engine.
 * Each top-level paragraph/table is a logical source block, explicitly labeled
 * in every snapshot so that the compiler cannot invent a printed page number.
 * Converted HTML is parsed in a detached document and is never rendered.
 */
export async function extractDocx(file: File, documentIndex: number): Promise<ExtractedDocument> {
  const mammoth = await import("mammoth");
  const converted = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, {
    externalFileAccess: false, ignoreEmptyParagraphs: false,
  });
  const html = new DOMParser().parseFromString(converted.value, "text/html");
  const id = "doc-" + documentIndex;
  const pages: ExtractedPage[] = Array.from(html.body.children).map((block, index) => {
    const images = Array.from(block.querySelectorAll("img")).map((image, imageIndex) => ({
      id: `block-${index + 1}-image-${imageIndex + 1}`, width: 0, height: 0,
      dataUrl: image.getAttribute("src") ?? "",
    })).filter(image => /^data:image\//i.test(image.dataUrl));
    return {
      documentId: id, fileName: file.name, pageNumber: index + 1,
      sourceLocation: `DOCX block ${index + 1} (logical, not a printed page)`,
      text: blockText(block).trim(), hasVisual: images.length > 0,
      embeddedImages: images, previewImageDataUrl: images[0]?.dataUrl,
      externalLinks: Array.from(block.querySelectorAll("a[href]")).map(link => link.getAttribute("href") ?? "")
        .filter(link => /^https?:\/\//i.test(link)),
      extractionIssues: index === 0 ? converted.messages.map(message => `${message.type}: ${message.message}`) : [],
    };
  });
  if (!pages.length) throw new Error("DOCX không có nội dung đọc được; không tạo snapshot rỗng giả.");
  return { id, fileName: file.name, pageCount: pages.length, pages, pagination: "logical-blocks" };
}

export async function extractDocument(file: File, documentIndex: number) {
  if (/\.docx$/i.test(file.name)) return extractDocx(file, documentIndex);
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return extractPdf(file, documentIndex);
  throw new Error("Định dạng chưa được hỗ trợ: " + file.name + ". Hãy chọn PDF hoặc DOCX.");
}
