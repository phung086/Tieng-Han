import { NextResponse } from "next/server";
import { appendImportPages } from "@/lib/import-job-store";
import type { ImportJobPage } from "@/lib/import-jobs";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function PUT(
  request: Request,
  context: RouteContext,
) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json()) as {
      pages?: ImportJobPage[];
    };

    if (!Array.isArray(body.pages) || !body.pages.length) {
      return NextResponse.json(
        { error: "Batch không có page snapshot." },
        { status: 400 },
      );
    }

    if (body.pages.length > 10) {
      return NextResponse.json(
        { error: "Mỗi batch tối đa 10 trang." },
        { status: 400 },
      );
    }

    const job = await appendImportPages(jobId, body.pages);
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        uploadedPages: job.uploadedPages,
        totalPages: job.totalPages,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể upload page snapshot.",
      },
      { status: 500 },
    );
  }
}
