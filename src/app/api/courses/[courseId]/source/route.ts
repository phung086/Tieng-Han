import { NextResponse } from "next/server";
import { getCourseLibrary } from "@/lib/course-consumer";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getCourseAccess } from "@/lib/db/course-access";
import { getImportJob, readImportPage } from "@/lib/import-job-store";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  if (isDatabaseConfigured()) {
    const user = await getCurrentUser();
    const access = await getCourseAccess({ role: user?.role ?? "learner" }, courseId);
    if (!access.allowed) return NextResponse.json({ error: "Không có quyền xem nguồn của khóa học này." }, { status: 403, headers: noStore });
  }
  const course = (await getCourseLibrary()).find(item => item.id === courseId);
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404, headers: noStore });
  // Resolve only a server-known course and its own import. Never accept filesystem paths or arbitrary job ids.
  const jobId = course.source?.importJobId ?? (/^course-(import-[a-z0-9-]{8,80})$/i.exec(course.id)?.[1]);
  if (!jobId) return NextResponse.json({ error: "Khóa học chưa có bản lưu nguồn. Cần nhập lại tài liệu để đối chiếu." }, { status: 404, headers: noStore });
  const job = await getImportJob(jobId);
  if (!job || job.documents.some(document => !(course.source?.fileNames ?? [course.source?.fileName]).includes(document.fileName))) {
    return NextResponse.json({ error: "Không tìm thấy bản lưu nguồn khớp khóa học." }, { status: 404, headers: noStore });
  }
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
    return NextResponse.json({ ...metadata, page }, { headers: noStore });
  } catch {
    // Keep the declared page and navigation visible so a damaged page cannot vanish.
    return NextResponse.json({ ...metadata, page: null, error: "Trang nguồn này bị thiếu hoặc hỏng. Cần khôi phục snapshot; không được tính là đã bao phủ." }, { headers: noStore });
  }
}
