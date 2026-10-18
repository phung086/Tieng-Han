import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdf, ocrLowTextPages } from "@/lib/pdf-extractor";

const pdf = vi.hoisted(() => ({ numPages: 3, getPage: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {}, OPS: { paintImageXObject: 1, paintInlineImageXObject: 2, paintImageMaskXObject: 3, paintSolidColorImageMask: 4 },
  getDocument: () => ({ promise: Promise.resolve(pdf) }),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("PDF page and OCR batch recovery", () => {
  it("retains a failed page with diagnostics and extracts later pages", async () => {
    vi.stubGlobal("window", { document: { createElement: () => ({
      getContext: () => ({}), toDataURL: () => "data:image/jpeg;base64,preview",
    }) } });
    pdf.getPage.mockImplementation(async (number: number) => {
      if (number === 2) throw new Error("damaged PDF page");
      return { getTextContent: async () => ({ items: [{ str: "Source page " + number, hasEOL: true }] }),
        getOperatorList: async () => ({ fnArray: [], argsArray: [] }), getAnnotations: async () => [],
        getViewport: () => ({ width: 100, height: 100 }), render: () => ({ promise: Promise.resolve() }) };
    });
    const document = await extractPdf(new File(["fixture"], "synthetic.pdf"), 0);
    expect(document.pages.map(page => page.pageNumber)).toEqual([1, 2, 3]);
    expect(document.pages[1].extractionIssues).toHaveLength(1);
    expect(document.pages[2].text).toBe("Source page 3");
    expect(document.pages[2].previewImageDataUrl).toBe("data:image/jpeg;base64,preview");
    expect(document.pageCount).toBe(3);
  });

  it("continues after OCR failures, keeps every image and flags missing output", async () => {
    pdf.getPage.mockResolvedValue({});
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "provider unavailable" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [4, 5, 6].map(pageNumber => ({ pageNumber, text: "OCR source " + pageNumber })) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pages: [] }) });
    vi.stubGlobal("fetch", fetch);
    const pages = Array.from({ length: 7 }, (_, index) => ({ documentId: "doc-0", fileName: "synthetic.pdf",
      pageNumber: index + 1, text: "", hasVisual: true, embeddedImages: [], externalLinks: [],
      previewImageDataUrl: "data:image/jpeg;base64,fixture" }));
    const result = await ocrLowTextPages(new File(["fixture"], "synthetic.pdf"), { id: "doc-0", fileName: "synthetic.pdf", pageCount: 7, pages });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.pages).toHaveLength(7);
    expect(result.pages[0].extractionIssues?.join()).toContain("thất bại");
    expect(result.pages[3].text).toBe("OCR source 4");
    expect(result.pages[6].extractionIssues?.join()).toContain("chưa trả");
    expect(result.pages.every(page => page.previewImageDataUrl)).toBe(true);
  });
});
