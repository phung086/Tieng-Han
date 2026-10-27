import { z } from "zod";
import type { ImportJob, ImportJobPage, ImportSourceFingerprint } from "@/lib/import-jobs";

function isPortableSourceFilename(value: string) {
  if (value === "." || value === "..") return false;
  // File.name should be a leaf name, not a path or a Windows alternate data stream.
  if (/[<>:"/\\|?*\u0000-\u001f]/u.test(value)) return false;
  // Windows reserves these device names even when an extension is present.
  const deviceName = (value.split(".", 1)[0] ?? value).replace(/[ .]+$/u, "");
  return !/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/iu.test(deviceName);
}

export const sourceFingerprintSchema = z.object({
  // Preserve the exact filename for identity; reject blank names and Windows-ambiguous trailing dots/spaces.
  name: z.string().refine(
    (value) => value.trim().length > 0 && !/[ .]$/.test(value) && isPortableSourceFilename(value),
    { message: "source filename must be a non-blank portable filename without path separators, reserved characters/device names, or trailing dots/spaces" },
  ),
  // An imported PDF/DOCX must contain bytes; zero-byte files cannot represent a usable textbook source.
  size: z.number().int().positive(),
  lastModified: z.number().int().nonnegative(),
  pageCount: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

// Preserve exact source names, but reject aliases used by common case-insensitive,
// Unicode-normalizing filesystems and Windows paths (which ignore trailing dots/spaces).
function sourceFilenameCollisionKey(name: string) {
  return name.normalize("NFC").replace(/[ .]+$/u, "").toLowerCase().normalize("NFC");
}

export const sourceManifestSchema = z.array(sourceFingerprintSchema).superRefine((items, ctx) => {
  const names = new Set<string>();
  items.forEach((item, index) => {
    const key = sourceFilenameCollisionKey(item.name);
    if (names.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "name"],
        message: "duplicate or colliding source filename after case/Unicode/path normalization",
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
