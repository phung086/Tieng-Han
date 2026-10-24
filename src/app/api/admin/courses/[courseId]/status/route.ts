import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSameOrigin,
  recordAuditEvent,
  requireAdmin,
} from "@/lib/auth/server";
import { setCourseStatus } from "@/lib/db/course-catalog";
import {
  fingerprintRuntimeCourseEvidence,
  getCourseLibrary,
} from "@/lib/course-consumer";
import {
  COURSE_BUNDLE_FORMAT,
  COURSE_BUNDLE_VERSION,
  type CompiledCourseBundle,
} from "@/lib/course-bundle";
import {
  auditCurriculumCoverage,
  isCurrentCompleteCoverage,
} from "@/lib/curriculum-coverage";

export const runtime = "nodejs";

const statusSchema = z.object({
  status: z.enum(["draft", "published", "archived"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Yêu cầu không cùng nguồn." },
      { status: 403 },
    );
  }

  try {
    const admin = await requireAdmin();
    const { courseId } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Trạng thái giáo trình không hợp lệ." },
        { status: 400 },
      );
    }

    if (parsed.data.status === "published") {
      const candidate = (await getCourseLibrary()).find(course => course.id === courseId);
      if (!candidate) return NextResponse.json({ error: "Không tìm thấy giáo trình." }, { status: 404 });
      const source = candidate.source;
      if (!source?.sourceManifest?.length || !source.sourceInventory || !source.evidenceFingerprint) {
        return NextResponse.json({
          error: "Chưa thể xuất bản: khóa học chưa lưu source manifest, inventory và fingerprint hiện hành.",
        }, { status: 409 });
      }
      if (source.evidenceFingerprint !== fingerprintRuntimeCourseEvidence(candidate)) {
        return NextResponse.json({
          error: "Chưa thể xuất bản: nội dung hoặc bằng chứng nguồn đã thay đổi sau lần đối chiếu gần nhất.",
        }, { status: 409 });
      }

      const evidenceBundle: CompiledCourseBundle = {
        format: COURSE_BUNDLE_FORMAT,
        version: COURSE_BUNDLE_VERSION,
        sourceFiles: source.fileNames ?? source.sourceManifest.map(item => item.name),
        sourceManifest: source.sourceManifest,
        sourceInventory: source.sourceInventory,
        course: {
          title: candidate.title,
          level: candidate.level,
          edition: source.edition,
          lessons: candidate.lessons,
          questions: candidate.questions,
        },
      };
      const currentCoverage = auditCurriculumCoverage(evidenceBundle);
      if (
        !isCurrentCompleteCoverage(currentCoverage) ||
        !isCurrentCompleteCoverage(source.curriculumCoverage)
      ) {
        return NextResponse.json({
          error: "Chưa thể xuất bản: cần đối chiếu lại inventory với đúng nội dung và bài luyện đang lưu.",
        }, { status: 409 });
      }
    }
    const course = await setCourseStatus(
      courseId,
      parsed.data.status,
    );

    if (!course) {
      return NextResponse.json(
        { error: "Không tìm thấy giáo trình." },
        { status: 404 },
      );
    }

    await recordAuditEvent({
      actorUserId: admin.id,
      eventType: "course.status_changed",
      entityType: "course",
      entityId: courseId,
      metadata: { status: parsed.data.status },
    });

    return NextResponse.json({
      course: {
        id: course.course_id,
        status: course.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật giáo trình.",
      },
      { status: 403 },
    );
  }
}
