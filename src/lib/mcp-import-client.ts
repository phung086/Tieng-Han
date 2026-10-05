"use client";

import {
  buildHandoffPackage,
  type HandoffLessonStart,
} from "@/lib/chatgpt-handoff";
import type { ExtractedDocument } from "@/lib/pdf-extractor";
import {
  defaultLanguageProfile,
  type LanguageProfile,
} from "@/lib/language-profile";
import type {
  ImportJob,
  ImportJobPage,
} from "@/lib/import-jobs";

type QueueInput = {
  files: File[];
  documents: ExtractedDocument[];
  maps: Array<{
    fileName: string;
    starts: HandoffLessonStart[];
  }>;
  courseHint: {
    title: string;
    level: string;
    edition?: string;
  };
  language?: LanguageProfile;
  onProgress?: (uploaded: number, total: number) => void;
};

async function jsonResponse<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "MCP bridge request thất bại.");
  }
  return payload;
}

export async function queueMcpImportJob(input: QueueInput) {
  const handoff = await buildHandoffPackage({
    files: input.files,
    documents: input.documents,
    maps: input.maps,
    courseHint: input.courseHint,
    language: input.language ?? defaultLanguageProfile,
  });

  const createResponse = await fetch("/api/import-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: input.language ?? defaultLanguageProfile,
      courseHint: input.courseHint,
      sourceManifest: handoff.sourceFiles,
      documents: input.documents.map((document) => ({
        documentId: document.id,
        fileName: document.fileName,
        pageCount: document.pageCount,
      })),
      detectedMaps: input.maps,
    }),
  });

  const created = await jsonResponse<{ job: ImportJob }>(
    createResponse,
  );
  const jobId = created.job.id;
  const pages: ImportJobPage[] = input.documents.flatMap((document) =>
    document.pages.map((page) => ({
      documentId: page.documentId,
      fileName: page.fileName,
      pageNumber: page.pageNumber,
      text: page.text,
      hasVisual: page.hasVisual,
      previewImageDataUrl: page.previewImageDataUrl,
      embeddedImages: [],
      externalLinks: page.externalLinks,
    })),
  );

  const batchSize = 6;
  let uploaded = 0;

  for (let offset = 0; offset < pages.length; offset += batchSize) {
    const batch = pages.slice(offset, offset + batchSize);
    const response = await fetch(
      "/api/import-jobs/" + encodeURIComponent(jobId) + "/pages",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: batch }),
      },
    );

    await jsonResponse(response);
    uploaded += batch.length;
    input.onProgress?.(uploaded, pages.length);
  }

  const queueResponse = await fetch(
    "/api/import-jobs/" + encodeURIComponent(jobId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "queue" }),
    },
  );

  return (await jsonResponse<{ job: ImportJob }>(queueResponse)).job;
}

export async function getMcpImportJob(jobId: string) {
  const response = await fetch(
    "/api/import-jobs/" + encodeURIComponent(jobId),
    { cache: "no-store" },
  );
  return (await jsonResponse<{ job: ImportJob }>(response)).job;
}

export async function consumeMcpImportJob(jobId: string) {
  const response = await fetch(
    "/api/import-jobs/" + encodeURIComponent(jobId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "consume" }),
    },
  );
  return (await jsonResponse<{ job: ImportJob }>(response)).job;
}

export async function requeueMcpImportJob(jobId: string) {
  const response = await fetch(
    "/api/import-jobs/" + encodeURIComponent(jobId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "requeue" }),
    },
  );
  return (await jsonResponse<{ job: ImportJob }>(response)).job;
}
