import type { CompiledCourseBundle } from "@/lib/course-bundle";
import type { LanguageProfile } from "@/lib/language-profile";

export const IMPORT_JOB_FORMAT = "haneul-import-job";
export const IMPORT_JOB_VERSION = 1;

export type ImportJobStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "consumed";

export type ImportSourceFingerprint = {
  name: string;
  size: number;
  lastModified: number;
  pageCount: number;
  sha256: string;
};

export type ImportLessonStart = {
  lessonId: number;
  pageNumber: number;
  titleHint?: string;
};

export type ImportJobDocument = {
  documentId: string;
  fileName: string;
  pageCount: number;
};

export type ImportJobPage = {
  documentId: string;
  fileName: string;
  pageNumber: number;
  text: string;
  hasVisual: boolean;
  previewImageDataUrl?: string;
  embeddedImages?: Array<{
    id: string;
    width: number;
    height: number;
    dataUrl: string;
  }>;
  externalLinks?: string[];
};

export type ImportJob = {
  format: typeof IMPORT_JOB_FORMAT;
  version: typeof IMPORT_JOB_VERSION;
  id: string;
  status: ImportJobStatus;
  createdAt: string;
  updatedAt: string;
  language: LanguageProfile;
  courseHint: {
    title: string;
    level: string;
    edition?: string;
  };
  sourceManifest: ImportSourceFingerprint[];
  documents: ImportJobDocument[];
  detectedMaps: Array<{
    fileName: string;
    starts: ImportLessonStart[];
  }>;
  uploadedPages: number;
  totalPages: number;
  resultBundle?: CompiledCourseBundle;
  error?: string;
};

export type CreateImportJobInput = Pick<
  ImportJob,
  "language" | "courseHint" | "sourceManifest" | "documents" | "detectedMaps"
>;


export function canDeleteImportJob(status: ImportJobStatus) {
  return status === "failed" || status === "consumed";
}
