import { getCourseLibrary } from "@/lib/course-consumer";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getCourseAccess } from "@/lib/db/course-access";
import { getImportJob } from "@/lib/import-job-store";

export const sourceHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function resolveCourseSource(courseId: string) {
  if (isDatabaseConfigured()) {
    const user = await getCurrentUser();
    const access = await getCourseAccess({ role: user?.role ?? "learner" }, courseId);
    if (!access.allowed) return { error: "Không có quyền xem nguồn của khóa học này.", status: 403 } as const;
  }
  const course = (await getCourseLibrary()).find(item => item.id === courseId);
  if (!course) return { error: "Không tìm thấy khóa học.", status: 404 } as const;
  const jobId = course.source?.importJobId ?? (/^course-(import-[a-z0-9-]{8,80})$/i.exec(course.id)?.[1]);
  if (!jobId) return { error: "Khóa học chưa có bản lưu nguồn. Cần nhập lại tài liệu để đối chiếu.", status: 404 } as const;
  const job = await getImportJob(jobId);
  if (!job || job.documents.some(document => !(course.source?.fileNames ?? [course.source?.fileName]).includes(document.fileName))) {
    return { error: "Không tìm thấy bản lưu nguồn khớp khóa học.", status: 404 } as const;
  }
  return { course, job } as const;
}
