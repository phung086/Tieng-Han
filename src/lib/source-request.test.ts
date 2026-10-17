import { describe, expect, it } from "vitest";
import { acceptsFullSourceValidation, prepareSourceRequest } from "@/lib/source-request";

describe("no omitted source requests or QA findings", () => {
  it("rejects oversized text and visual batches instead of silently dropping the final source", () => {
    const pages = Array.from({ length: 9 }, (_, index) => ({ fileName: "synthetic.pdf", pageNumber: index + 1, text: "source ".repeat(100), imageDataUrl: "data:image/png;base64,AA==" }));
    expect(() => prepareSourceRequest(pages, 75_000, 8)).toThrow(RangeError);
    expect(() => prepareSourceRequest(pages, 500, 9)).toThrow(RangeError);
    const result = prepareSourceRequest(pages, 75_000, 9);
    expect(result.visualPages).toHaveLength(9);
    expect(result.source).toContain("p.9");
    expect(result.pages.at(-1)?.text).toBe(pages.at(-1)?.text);
  });
  it("keeps logical locations and split-page markers", () => {
    const result = prepareSourceRequest([{ fileName: "synthetic.docx", pageNumber: 3, text: "all original words", sourceLocation: "logical block 3", part: 2 }], 500, 8);
    expect(result.source).toContain("logical block 3 · part 2");
  });
  it("rejects any missing item, QA issue, false pass or sub-100 score", () => {
    const valid = { pass: true, coverageScore: 100, groundingScore: 100, issues: [], missingTopics: [] };
    expect(acceptsFullSourceValidation(valid)).toBe(true);
    for (const change of [{ pass: false }, { coverageScore: 99 }, { groundingScore: 99 }, { issues: ["wrong original prompt"] }, { missingTopics: ["last vocabulary item"] }]) {
      expect(acceptsFullSourceValidation({ ...valid, ...change })).toBe(false);
    }
  });
});
