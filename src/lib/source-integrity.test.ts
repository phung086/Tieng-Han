import { describe, expect, it } from "vitest";
import {
  sameSourceManifest,
  sourceManifestSchema,
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
});
