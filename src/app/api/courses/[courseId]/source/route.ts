import { NextResponse } from "next/server";
import { readImportPage } from "@/lib/import-job-store";
import { resolveCourseSource, sourceHeaders as noStore } from "@/lib/course-source-access";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const source = await resolveCourseSource(courseId);
  if ("error" in source) return NextResponse.json({ error: source.error }, { status: source.status, headers: noStore });
  const { course, job } = source;
  const params = new URL(request.url).searchParams;
  const documentId = params.get("document") ?? job.documents[0]?.documentId;
  const document = job.documents.find(item => item.documentId === documentId);
  const pageNumber = Number(params.get("page") ?? 1);
  if (!document || !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > document.pageCount) {
    return NextResponse.json({ error: "Số trang hoặc tài liệu không hợp lệ." }, { status: 400, headers: noStore });
  }
  const metadata = { documents: job.documents, courseTitle: course.title, pageNumber, documentId };
  try {
    const page = await readImportPage(job.id, document.documentId, pageNumber);
    const displayed = params.get("view") === "text" ? { ...page, previewImageDataUrl: undefined, embeddedImages: undefined } : page;
    return NextResponse.json({ ...metadata, page: displayed }, { headers: noStore });
  } catch {
    // Keep the declared page and navigation visible so a damaged page cannot vanish.
    return NextResponse.json({ ...metadata, page: null, error: "Trang nguồn này bị thiếu hoặc hỏng. Cần khôi phục snapshot; không được tính là đã bao phủ." }, { headers: noStore });
  }
}
