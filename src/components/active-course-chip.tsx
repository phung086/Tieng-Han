"use client";

import Link from "next/link";
import { BookOpenText, ChevronRight } from "lucide-react";
import { useContent } from "@/lib/content-store";

export function ActiveCourseChip({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { course } = useContent();

  if (!course.id || course.id === "empty") return null;

  return (
    <Link
      className={
        compact
          ? "active-course-chip-v5 compact"
          : "active-course-chip-v5"
      }
      href="/learn"
      title={course.title}
    >
      <span className="active-course-icon-v5">
        <BookOpenText size={17} />
      </span>
      <span className="active-course-copy-v5">
        <small>{course.level || "Đang học"}</small>
        <strong>{course.title}</strong>
      </span>
      <ChevronRight size={16} />
    </Link>
  );
}
