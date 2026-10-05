import { NextResponse } from "next/server";
import { defaultLanguageProfile } from "@/lib/language-profile";
import {
  createImportJob,
  listImportJobs,
} from "@/lib/import-job-store";
import type {
  CreateImportJobInput,
  ImportJobStatus,
} from "@/lib/import-jobs";

export const runtime = "nodejs";

const statuses = new Set<ImportJobStatus>([
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
  "consumed",
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && statuses.has(rawStatus as ImportJobStatus)
        ? (rawStatus as ImportJobStatus)
        : undefined;
    const jobs = await listImportJobs(status);

    return NextResponse.json({
      jobs: jobs.map(({ resultBundle: _resultBundle, ...job }) => job),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc import jobs.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateImportJobInput>;

    if (
      !Array.isArray(body.documents) ||
      !body.documents.length ||
      !Array.isArray(body.sourceManifest) ||
      !body.sourceManifest.length
    ) {
      return NextResponse.json(
        { error: "Import job thiếu documents hoặc sourceManifest." },
        { status: 400 },
      );
    }

    const job = await createImportJob({
      language: body.language ?? defaultLanguageProfile,
      courseHint: {
        title: String(body.courseHint?.title ?? "Imported course"),
        level: String(body.courseHint?.level ?? ""),
        edition: body.courseHint?.edition
          ? String(body.courseHint.edition)
          : undefined,
      },
      sourceManifest: body.sourceManifest,
      documents: body.documents,
      detectedMaps: Array.isArray(body.detectedMaps)
        ? body.detectedMaps
        : [],
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo import job.",
      },
      { status: 500 },
    );
  }
}
