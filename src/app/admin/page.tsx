import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getAdminCourseCatalog,
  getAdminOverview,
  getAdminUsers,
  syncCourseCatalog,
} from "@/lib/db/course-catalog";
import { getCourseLibrary } from "@/lib/course-consumer";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="page admin-setup-v1">
        <span className="experience-kicker">PHASE SCALE 1</span>
        <h1>PostgreSQL chưa được cấu hình.</h1>
        <p>
          Thêm DATABASE_URL vào .env.local, chạy pnpm db:migrate rồi đăng ký tài khoản admin.
        </p>
        <code>pnpm db:migrate</code>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");

  const runtimeCourses = await getCourseLibrary();
  await syncCourseCatalog(
    runtimeCourses.map((course) => ({
      id: course.id,
      title: course.title,
      level: course.level,
      source: course.source,
    })),
  );

  const [overview, courses, users] = await Promise.all([
    getAdminOverview(),
    getAdminCourseCatalog(),
    getAdminUsers(),
  ]);

  return (
    <div className="page">
      <AdminDashboard
        overview={overview}
        initialCourses={courses.map((course) => ({
          id: course.course_id,
          title: course.title,
          level: course.level,
          status: course.status,
          updatedAt: course.updated_at.toISOString(),
        }))}
        initialUsers={users.map((item) => ({
          id: item.id,
          email: item.email,
          name: item.name,
          role: item.role,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          lastLoginAt: item.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
