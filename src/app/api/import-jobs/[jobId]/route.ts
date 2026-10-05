import { NextResponse } from "next/server";
import {
  getImportJob,
  queueImportJob,
  requeueImportJob,
} from "@/lib/import-job-store";
import { consumeReadyImportJob } from "@/lib/course-consumer";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { jobId } = await context.params;
    const job = await getImportJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: "Không tìm thấy import job." },
        { status: 404 },
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đọc import job.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json()) as { action?: string };

    if (body.action === "queue") {
      return NextResponse.json({
        job: await queueImportJob(jobId),
      });
    }

    if (body.action === "consume") {
      const result = await consumeReadyImportJob(jobId);
      return NextResponse.json({
        job: result.job,
        course: result.course,
      });
    }

    if (body.action === "requeue") {
      return NextResponse.json({
        job: await requeueImportJob(jobId),
      });
    }

    return NextResponse.json(
      { error: "Action không được hỗ trợ." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật import job.",
      },
      { status: 500 },
    );
  }
}
