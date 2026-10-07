import type { AuthUser, UserRole } from "@/lib/auth/types";
import {
  getCourseStatusMap,
  type CoursePublicationStatus,
} from "@/lib/db/course-catalog";

export type CourseAccess = {
  exists: boolean;
  allowed: boolean;
  status: CoursePublicationStatus | null;
};

export function isCourseStatusAccessible(
  role: UserRole,
  status: CoursePublicationStatus | null | undefined,
) {
  if (!status) return false;
  if (role === "admin") return true;
  return status === "published";
}

export async function getCourseAccess(
  user: Pick<AuthUser, "role">,
  courseId: string,
): Promise<CourseAccess> {
  const statusMap = await getCourseStatusMap([courseId]);
  const status = statusMap.get(courseId) ?? null;

  return {
    exists: Boolean(status),
    allowed: isCourseStatusAccessible(user.role, status),
    status,
  };
}
