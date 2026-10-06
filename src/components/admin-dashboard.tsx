"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Database,
  FileUp,
  KeyRound,
  Shield,
  Users,
} from "lucide-react";

type CourseStatus = "draft" | "published" | "archived";
type Role = "learner" | "admin";

type CourseRow = {
  id: string;
  title: string;
  level: string;
  status: CourseStatus;
  updatedAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
  createdAt: string;
  lastLoginAt: string | null;
};

export function AdminDashboard({
  overview,
  initialCourses,
  initialUsers,
}: {
  overview: {
    users: number;
    learners: number;
    admins: number;
    activeSessions: number;
    enrollments: number;
    savedStates: number;
  };
  initialCourses: CourseRow[];
  initialUsers: UserRow[];
}) {
  const [courses, setCourses] = useState(initialCourses);
  const [users, setUsers] = useState(initialUsers);
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");

  async function updateCourseStatus(
    courseId: string,
    status: CourseStatus,
  ) {
    setPendingKey("course:" + courseId);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/courses/" +
          encodeURIComponent(courseId) +
          "/status",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể cập nhật giáo trình.");
        return;
      }

      setCourses((current) =>
        current.map((course) =>
          course.id === courseId ? { ...course, status } : course,
        ),
      );
    } finally {
      setPendingKey("");
    }
  }

  async function updateUserRole(userId: string, role: Role) {
    setPendingKey("user:" + userId);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/users/" +
          encodeURIComponent(userId) +
          "/role",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể cập nhật vai trò.");
        return;
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, role } : user,
        ),
      );
    } finally {
      setPendingKey("");
    }
  }

  const metrics = [
    { label: "Người dùng", value: overview.users, icon: Users },
    { label: "Learner", value: overview.learners, icon: BookOpenCheck },
    { label: "Admin", value: overview.admins, icon: Shield },
    { label: "Phiên đăng nhập", value: overview.activeSessions, icon: KeyRound },
    { label: "Enrollment", value: overview.enrollments, icon: Database },
    { label: "Progress đã sync", value: overview.savedStates, icon: Database },
  ];

  return (
    <div className="admin-page-v1">
      <header className="admin-head-v1">
        <div>
          <span className="experience-kicker">HANEUL ADMIN</span>
          <h1>Quản trị nội dung và tài khoản.</h1>
          <p>
            Compiler vẫn chạy theo pipeline cũ; khu vực này chỉ quản lý người dùng, xuất bản và dữ liệu học.
          </p>
        </div>
        <Link className="primary-button" href="/import">
          <FileUp size={17} /> Nhập giáo trình
        </Link>
      </header>

      <section className="admin-metrics-v1">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <span><Icon size={18} /></span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </article>
        ))}
      </section>

      {error ? <div className="admin-error-v1">{error}</div> : null}

      <section className="admin-panel-v1">
        <div className="admin-panel-head-v1">
          <div>
            <span className="experience-kicker">COURSE CATALOG</span>
            <h2>Giáo trình & trạng thái xuất bản</h2>
          </div>
          <Link href="/learn">
            Xem learner view <ArrowRight size={15} />
          </Link>
        </div>

        <div className="admin-course-list-v1">
          {courses.map((course) => (
            <article key={course.id}>
              <div>
                <strong>{course.title}</strong>
                <span>{course.level || "Chưa xác định cấp độ"}</span>
              </div>
              <span className={"admin-status-v1 " + course.status}>
                {course.status}
              </span>
              <select
                aria-label={"Trạng thái " + course.title}
                disabled={pendingKey === "course:" + course.id}
                onChange={(event) =>
                  void updateCourseStatus(
                    course.id,
                    event.target.value as CourseStatus,
                  )
                }
                value={course.status}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel-v1">
        <div className="admin-panel-head-v1">
          <div>
            <span className="experience-kicker">USERS & ROLES</span>
            <h2>Người dùng gần đây</h2>
          </div>
        </div>

        <div className="admin-user-list-v1">
          {users.map((user) => (
            <article key={user.id}>
              <div className="admin-user-avatar-v1">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <span className={"admin-role-v1 " + user.role}>
                {user.role}
              </span>
              <select
                aria-label={"Vai trò " + user.email}
                disabled={pendingKey === "user:" + user.id}
                onChange={(event) =>
                  void updateUserRole(
                    user.id,
                    event.target.value as Role,
                  )
                }
                value={user.role}
              >
                <option value="learner">Learner</option>
                <option value="admin">Admin</option>
              </select>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
