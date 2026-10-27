import { describe, expect, it } from "vitest";
import {
  sameSourceManifest,
  sourceManifestSchema,
  validateImportDocuments,
} from "@/lib/source-integrity";
import type { ImportSourceFingerprint } from "@/lib/import-jobs";

function fingerprint(overrides: Partial<ImportSourceFingerprint> = {}): ImportSourceFingerprint {
  return {
    name: "SÁCH SƠ CẤP 1.pdf",
    size: 8111729,
    lastModified: 1791194978904,
    pageCount: 380,
    sha256: "a".repeat(64),
    ...overrides,
  };
}

describe("source manifest fingerprint integrity", () => {
  it("matches exact fingerprints independent of manifest ordering", () => {
    const first = fingerprint();
    const second = fingerprint({ name: "workbook.pdf", sha256: "b".repeat(64), pageCount: 120 });
    expect(sameSourceManifest([first, second], [second, first])).toBe(true);
  });

  it("compares SHA-256 hex case-insensitively because the schema accepts either case", () => {
    const expected = fingerprint();
    const received = fingerprint({ sha256: "A".repeat(64) });
    expect(sourceManifestSchema.safeParse([received]).success).toBe(true);
    expect(sameSourceManifest([expected], [received])).toBe(true);
  });

  it("rejects changes to any source fingerprint field", () => {
    const expected = fingerprint();
    expect(sameSourceManifest([expected], [fingerprint({ size: expected.size + 1 })])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ lastModified: expected.lastModified + 1 })])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ pageCount: expected.pageCount + 1 })])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ sha256: "b".repeat(64) })])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ name: "different.pdf" })])).toBe(false);
  });

  it("fails closed for empty, duplicate-name, malformed, or differently spelled filenames", () => {
    const expected = fingerprint();
    expect(sameSourceManifest([], [])).toBe(false);
    expect(sameSourceManifest([expected, expected], [expected, expected])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ sha256: "not-a-hash" })])).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ name: " SÁCH SƠ CẤP 1.pdf " })])).toBe(false);
    expect(sourceManifestSchema.safeParse([fingerprint({ name: "   " })]).success).toBe(false);
    expect(sourceManifestSchema.safeParse([fingerprint({ size: 0 })]).success).toBe(false);
    expect(sameSourceManifest([expected], [fingerprint({ size: 0 })])).toBe(false);
  });

  it("rejects case-only filename collisions without rewriting the exact source names", () => {
    const upper = fingerprint({ name: "Book.pdf" });
    const lower = fingerprint({ name: "book.pdf", sha256: "b".repeat(64) });

    expect(sourceManifestSchema.safeParse([upper, lower]).success).toBe(false);
    expect(sourceManifestSchema.parse([upper])[0]?.name).toBe("Book.pdf");
  });

  it("rejects canonically equivalent Unicode filenames as ambiguous", () => {
    const composed = fingerprint({ name: "école.pdf" });
    const decomposed = fingerprint({ name: "école.pdf", sha256: "b".repeat(64) });

    expect(composed.name).not.toBe(decomposed.name);
    expect(sourceManifestSchema.safeParse([composed, decomposed]).success).toBe(false);
  });

  it("rejects trailing-dot and trailing-space filenames that alias on Windows", () => {
    expect(sourceManifestSchema.safeParse([fingerprint({ name: "Book.pdf." })]).success).toBe(false);
    expect(sourceManifestSchema.safeParse([fingerprint({ name: "Book.pdf " })]).success).toBe(false);

    const normal = fingerprint({ name: "Book.pdf" });
    const dotted = fingerprint({ name: "Book.pdf.", sha256: "b".repeat(64) });
    const spaced = fingerprint({ name: "Book.pdf ", sha256: "c".repeat(64) });
    expect(sourceManifestSchema.safeParse([normal, dotted]).success).toBe(false);
    expect(sourceManifestSchema.safeParse([normal, spaced]).success).toBe(false);
  });

  it("rejects a document list whose manifest contains colliding filename variants", () => {
    expect(() => validateImportDocuments({
      documents: [
        { documentId: "book-a", fileName: "Book.pdf", pageCount: 12 },
        { documentId: "book-b", fileName: "book.pdf", pageCount: 8 },
      ],
      sourceManifest: [
        fingerprint({ name: "Book.pdf", pageCount: 12 }),
        fingerprint({ name: "book.pdf", pageCount: 8, sha256: "b".repeat(64) }),
      ],
    })).toThrow();
  });
  it("rejects path-like, invalid, and reserved Windows device filenames", () => {
    const invalidNames = [
      "../Book.pdf",
      "..\\\\Book.pdf",
      "folder/Book.pdf",
      "folder\\\\Book.pdf",
      "C:Book.pdf",
      "Book:stream",
      "bad\\u0000.pdf",
      "CON.pdf",
      "nul",
      "LPT1.docx",
    ];

    for (const name of invalidNames) {
      expect(sourceManifestSchema.safeParse([fingerprint({ name })]).success).toBe(false);
    }

    // Existing Vietnamese names with spaces, accents and parentheses remain valid.
    expect(sourceManifestSchema.safeParse([
      fingerprint({ name: "SBT-NÂNG-CAO- ( đáp án cuối sách ).pdf" }),
    ]).success).toBe(true);
  });

  it("rejects path-like names before an import job can be accepted", () => {
    const name = "../Book.pdf";
    expect(() => validateImportDocuments({
      documents: [{ documentId: "doc-1", fileName: name, pageCount: 12 }],
      sourceManifest: [fingerprint({ name, pageCount: 12 })],
    })).toThrow();
  });

});
