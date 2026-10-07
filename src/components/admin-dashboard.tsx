"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileText,
  FileUp,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Shield,
  Trash2,
  UserRoundX,
  Users,
} from "lucide-react";

type CourseStatus = "draft" | "published" | "archived";
type Role = "learner" | "admin";
type UserStatus = "active" | "disabled";
type ImportStatus =
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "consumed";

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
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
};

type AuditEventRow = {
  id: string;
  actorName: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type ImportJobRow = {
  id: string;
  status: ImportStatus;
  title: string;
  level: string;
  sourceFiles: string[];
  uploadedPages: number;
  totalPages: number;
  createdAt: string;
  updatedAt: string;
  completedLessonIds: number[];
  detectedLessonCount: number;
  pendingDetectedLessonCount: number;
  activeWork: Array<{
    lessonId: number;
    phase: "source-reading" | "drafting" | "qa";
    savedAt: string;
    pageNumber?: number;
  }>;
  error?: string;
};

const importStatusLabels: Record<ImportStatus, string> = {
  uploading: "Đang nhận nguồn",
  queued: "Đang chờ ChatGPT",
  processing: "Đang biên dịch",
  ready: "Sẵn sàng nhập",
  failed: "Cần xử lý",
  consumed: "Đã nhập khóa học",
};

const eventLabels: Record<string, string> = {
  "auth.registered": "Đăng ký tài khoản",
  "auth.logged_in": "Đăng nhập",
  "auth.logged_out": "Đăng xuất",
  "auth.password_changed": "Đổi mật khẩu",
  "auth.session_revoked": "Thu hồi phiên đăng nhập",
  "auth.other_sessions_revoked": "Đăng xuất thiết bị khác",
  "user.profile_updated": "Cập nhật hồ sơ",
  "user.role_changed": "Đổi vai trò",
  "user.status_changed": "Đổi trạng thái tài khoản",
  "course.status_changed": "Đổi trạng thái giáo trình",
  "import_job.deleted": "Xóa hồ sơ import",
};

function formatDate(value: string | null) {
  if (!value) return "Chưa đăng nhập";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDashboard({
  overview,
  initialCourses,
  initialUsers,
  initialAuditEvents,
  initialImportJobs,
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
  initialAuditEvents: AuditEventRow[];
  initialImportJobs: ImportJobRow[];
}) {
  const [courses, setCourses] = useState(initialCourses);
  const [users, setUsers] = useState(initialUsers);
  const [importJobs, setImportJobs] = useState(initialImportJobs);
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");

  const disabledCount = useMemo(
    () => users.filter((user) => user.status === "disabled").length,
    [users],
  );

  const activeImportCount = useMemo(
    () =>
      importJobs.filter((job) =>
        ["uploading", "queued", "processing", "ready"].includes(job.status),
      ).length,
    [importJobs],
  );

  const refreshImportJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/import-jobs", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        jobs?: ImportJobRow[];
      };
      if (Array.isArray(data.jobs)) {
        setImportJobs(data.jobs);
      }
    } catch {
      // Keep the last known monitor snapshot when refresh fails.
    }
  }, []);

  useEffect(() => {
    if (!activeImportCount) return;

    const timer = window.setInterval(() => {
      void refreshImportJobs();
    }, 8_000);

    return () => window.clearInterval(timer);
  }, [activeImportCount, refreshImportJobs]);

  async function runImportAction(
    jobId: string,
    action: "requeue" | "consume",
  ) {
    const pendingId = "import:" + jobId + ":" + action;
    setPendingKey(pendingId);
    setError("");

    try {
      const response = await fetch(
        "/api/import-jobs/" + encodeURIComponent(jobId),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Không thể cập nhật import job.");
        return;
      }

      await refreshImportJobs();
    } finally {
      setPendingKey("");
    }
  }

  async function deleteTerminalImportJob(job: ImportJobRow) {
    if (
      !window.confirm(
        "Xóa vĩnh viễn hồ sơ import cho “" +
          job.title +
          "”? Khóa học đã consume sẽ không bị xóa khỏi Course Library.",
      )
    ) {
      return;
    }

    const pendingId = "import:" + job.id + ":delete";
    setPendingKey(pendingId);
    setError("");

    try {
      const response = await fetch(
        "/api/import-jobs/" + encodeURIComponent(job.id),
        {
          method: "DELETE",
        },
      );
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Không thể xóa import job.");
        return;
      }

      setImportJobs((current) =>
        current.filter((item) => item.id !== job.id),
      );
    } finally {
      setPendingKey("");
    }
  }

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
    setPendingKey("user-role:" + userId);
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

  async function updateUserStatus(
    userId: string,
    status: UserStatus,
  ) {
    setPendingKey("user-status:" + userId);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/users/" +
          encodeURIComponent(userId) +
          "/status",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Không thể cập nhật trạng thái.");
        return;
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId ? { ...user, status } : user,
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
            Compiler vẫn chạy theo pipeline cũ; khu vực này chỉ quản lý người dùng,
            xuất bản và dữ liệu học.
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

      {error ? (
        <div className="admin-error-v1" role="alert">
          {error}
        </div>
      ) : null}

      <section className="admin-panel-v1 admin-import-monitor-v3">
        <div className="admin-panel-head-v1">
          <div>
            <span className="experience-kicker">IMPORT PIPELINE</span>
            <h2>Tiến trình biên dịch giáo trình</h2>
            <p className="admin-panel-note-v2">
              Theo dõi import job, lesson draft và checkpoint. Trạng thái đang làm
              được làm mới tự động mỗi 8 giây.
            </p>
          </div>
          <div className="admin-import-head-actions-v3">
            <span className="admin-live-count-v3">
              {activeImportCount} đang hoạt động
            </span>
            <button
              className="text-button"
              onClick={() => void refreshImportJobs()}
              type="button"
            >
              <RefreshCcw size={14} /> Làm mới
            </button>
          </div>
        </div>

        {importJobs.length ? (
          <div className="admin-import-list-v3">
            {importJobs.map((job) => {
              const uploadPercent = job.totalPages
                ? Math.min(
                    100,
                    Math.round(
                      (job.uploadedPages / job.totalPages) * 100,
                    ),
                  )
                : 0;
              const activeWork = job.activeWork[0];
              const sourceLabel = job.sourceFiles.join(" · ");

              return (
                <article
                  className={"admin-import-job-v3 " + job.status}
                  key={job.id}
                >
                  <div className="admin-import-job-icon-v3">
                    {job.status === "processing" ? (
                      <LoaderCircle className="spin" size={20} />
                    ) : job.status === "failed" ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </div>

                  <div className="admin-import-job-main-v3">
                    <div className="admin-import-job-title-v3">
                      <div>
                        <strong>{job.title}</strong>
                        <span>
                          {job.level || "Chưa xác định cấp độ"} ·{" "}
                          {sourceLabel || "Không rõ file nguồn"}
                        </span>
                      </div>
                      <span
                        className={
                          "admin-import-status-v3 " + job.status
                        }
                      >
                        {importStatusLabels[job.status]}
                      </span>
                    </div>

                    <div className="admin-import-progress-v3">
                      <div>
                        <span style={{ width: uploadPercent + "%" }} />
                      </div>
                      <small>
                        Nguồn {job.uploadedPages}/{job.totalPages} trang
                      </small>
                    </div>

                    <div className="admin-import-meta-v3">
                      <span>
                        {job.completedLessonIds.length} lesson draft đã lưu
                      </span>
                      {job.detectedLessonCount ? (
                        <span>
                          {job.pendingDetectedLessonCount} candidate còn chờ
                        </span>
                      ) : null}
                      {activeWork ? (
                        <span>
                          Bài {activeWork.lessonId} · {activeWork.phase}
                          {activeWork.pageNumber
                            ? " · p." + activeWork.pageNumber
                            : ""}
                        </span>
                      ) : null}
                      <span>Cập nhật {formatDate(job.updatedAt)}</span>
                    </div>

                    {job.error ? (
                      <p className="admin-import-error-v3">{job.error}</p>
                    ) : null}
                  </div>

                  <div className="admin-import-actions-v3">
                    {job.status === "failed" ? (
                      <button
                        className="secondary-button"
                        disabled={pendingKey === "import:" + job.id + ":requeue"}
                        onClick={() =>
                          void runImportAction(job.id, "requeue")
                        }
                        type="button"
                      >
                        <RotateCcw size={15} />
                        {pendingKey === "import:" + job.id + ":requeue"
                          ? "Đang đưa lại…"
                          : "Đưa lại hàng đợi"}
                      </button>
                    ) : null}

                    {job.status === "ready" ? (
                      <button
                        className="primary-button"
                        disabled={pendingKey === "import:" + job.id + ":consume"}
                        onClick={() =>
                          void runImportAction(job.id, "consume")
                        }
                        type="button"
                      >
                        {pendingKey === "import:" + job.id + ":consume"
                          ? "Đang nhập…"
                          : "Nhập vào thư viện"}
                      </button>
                    ) : null}

                    {job.status === "failed" ||
                    job.status === "consumed" ? (
                      <button
                        className="text-button danger"
                        disabled={
                          pendingKey ===
                          "import:" + job.id + ":delete"
                        }
                        onClick={() =>
                          void deleteTerminalImportJob(job)
                        }
                        type="button"
                      >
                        <Trash2 size={14} />
                        {pendingKey ===
                        "import:" + job.id + ":delete"
                          ? "Đang xóa…"
                          : "Xóa hồ sơ"}
                      </button>
                    ) : null}

                    {job.status === "queued" ||
                    job.status === "processing" ||
                    job.status === "uploading" ? (
                      <span className="admin-import-passive-v3">
                        Không cần thao tác
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty-v2">
            Chưa có import job. Chọn “Nhập giáo trình” để bắt đầu.
          </div>
        )}
      </section>

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
                <span>
                  {course.level || "Chưa xác định cấp độ"} · cập nhật{" "}
                  {formatDate(course.updatedAt)}
                </span>
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
            <span className="experience-kicker">USERS & ACCESS</span>
            <h2>Người dùng & quyền truy cập</h2>
            <p className="admin-panel-note-v2">
              {disabledCount} tài khoản đang bị vô hiệu hóa. Vô hiệu hóa sẽ thu hồi
              toàn bộ session của tài khoản đó.
            </p>
          </div>
        </div>

        <div className="admin-user-list-v1 admin-user-list-v2">
          {users.map((user) => (
            <article
              className={user.status === "disabled" ? "disabled" : ""}
              key={user.id}
            >
              <div className="admin-user-avatar-v1">
                {user.status === "disabled" ? (
                  <UserRoundX size={18} />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>

              <div className="admin-user-copy-v2">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>Đăng nhập gần nhất: {formatDate(user.lastLoginAt)}</small>
              </div>

              <div className="admin-user-badges-v2">
                <span className={"admin-role-v1 " + user.role}>
                  {user.role}
                </span>
                <span className={"admin-account-status-v2 " + user.status}>
                  {user.status === "active" ? (
                    <>
                      <CheckCircle2 size={12} /> active
                    </>
                  ) : (
                    <>
                      <UserRoundX size={12} /> disabled
                    </>
                  )}
                </span>
              </div>

              <div className="admin-user-controls-v2">
                <label>
                  <span>Vai trò</span>
                  <select
                    aria-label={"Vai trò " + user.email}
                    disabled={pendingKey === "user-role:" + user.id}
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
                </label>
                <label>
                  <span>Trạng thái</span>
                  <select
                    aria-label={"Trạng thái tài khoản " + user.email}
                    disabled={pendingKey === "user-status:" + user.id}
                    onChange={(event) =>
                      void updateUserStatus(
                        user.id,
                        event.target.value as UserStatus,
                      )
                    }
                    value={user.status}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel-v1">
        <div className="admin-panel-head-v1">
          <div>
            <span className="experience-kicker">AUDIT TRAIL</span>
            <h2>Hoạt động quản trị & tài khoản gần đây</h2>
          </div>
        </div>

        <div className="admin-audit-list-v2">
          {initialAuditEvents.length ? (
            initialAuditEvents.map((event) => (
              <article key={event.id}>
                <span className="admin-audit-icon-v2">
                  <Activity size={16} />
                </span>
                <div>
                  <strong>
                    {eventLabels[event.eventType] ?? event.eventType}
                  </strong>
                  <span>
                    {event.actorName || "Hệ thống"}
                    {event.entityType ? " · " + event.entityType : ""}
                  </span>
                </div>
                <time dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </article>
            ))
          ) : (
            <div className="admin-empty-v2">
              Chưa có audit event nào được ghi nhận.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
