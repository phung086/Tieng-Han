import { z } from "zod";
import type { ImportJob, ImportJobPage, ImportSourceFingerprint } from "@/lib/import-jobs";

export const sourceFingerprintSchema = z.object({
  // Validate non-blank names without trimming: the filename is part of the source fingerprint.
  name: z.string().refine((value) => value.trim().length > 0, { message: "source filename must not be blank" }),
  // An imported PDF/DOCX must contain bytes; zero-byte files cannot represent a usable textbook source.
  size: z.number().int().positive(),
  lastModified: z.number().int().nonnegative(),
  pageCount: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

// Preserve the exact filename for identity, but reject names that can collide on
// common case-insensitive or Unicode-normalizing filesystems.
function sourceFilenameCollisionKey(name: string) {
  return name.normalize("NFC").toLowerCase().normalize("NFC");
}

export const sourceManifestSchema = z.array(sourceFingerprintSchema).superRefine((items, ctx) => {
  const names = new Set<string>();
  items.forEach((item, index) => {
    const key = sourceFilenameCollisionKey(item.name);
    if (names.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "name"],
        message: "duplicate or colliding source filename after case/Unicode normalization",
      });
    }
    names.add(key);
  });
});

export function sameSourceManifest(expected: ImportSourceFingerprint[], received: ImportSourceFingerprint[]) {
  if (!expected.length || expected.length !== received.length) return false;
  if (!sourceManifestSchema.safeParse(expected).success || !sourceManifestSchema.safeParse(received).success) return false;
  const byName = new Map(received.map(item => [item.name, item]));
  return expected.every(item => {
    const actual = byName.get(item.name);
    return actual && actual.sha256.toLowerCase() === item.sha256.toLowerCase() && actual.size === item.size &&
      actual.lastModified === item.lastModified && actual.pageCount === item.pageCount;
  });
}

export function validateImportDocuments(job: Pick<ImportJob, "documents" | "sourceManifest">) {
  sourceManifestSchema.min(1).parse(job.sourceManifest);
  const documentSchema = z.object({
    documentId: z.string().regex(/^[a-z0-9_-]{1,80}$/i),
    fileName: z.string().min(1),
    pageCount: z.number().int().positive(),
  });
  z.array(documentSchema).min(1).parse(job.documents);
  if (job.documents.length !== job.sourceManifest.length) throw new Error("documents và sourceManifest không khớp.");
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const document of job.documents) {
    const nameKey = sourceFilenameCollisionKey(document.fileName);
    if (ids.has(document.documentId) || names.has(nameKey)) {
      throw new Error("Document id hoặc fileName bị trùng sau chuẩn hóa tên.");
    }
    ids.add(document.documentId);
    names.add(nameKey);
    const source = job.sourceManifest.find(item => item.name === document.fileName);
    if (!source || source.pageCount !== document.pageCount) throw new Error("Document không khớp nguồn: " + document.fileName);
  }
}

export function validateImportPage(job: Pick<ImportJob, "documents">, page: ImportJobPage) {
  const document = job.documents.find(item => item.documentId === page.documentId);
  if (!document || document.fileName !== page.fileName) throw new Error("Trang không thuộc tài liệu đã khai báo: " + page.documentId);
  if (!Number.isSafeInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > document.pageCount) {
    throw new Error("Trang ngoài phạm vi tài liệu: " + page.documentId + "/" + page.pageNumber);
  }
  if (typeof page.text !== "string" || typeof page.hasVisual !== "boolean") throw new Error("Page snapshot thiếu text hoặc hasVisual.");
}
