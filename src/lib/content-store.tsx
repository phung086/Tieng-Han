"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type LessonContent,
  type StudyQuestion,
} from "@/data/content";
import type { LanguageProfile } from "@/lib/language-profile";
import {
  clearStoredCourse,
  readStoredCourse,
  writeStoredCourse,
} from "@/lib/content-db";

export type RuntimeCourse = {
  id: string;
  title: string;
  level: string;
  language?: LanguageProfile;
  source?: {
    fileName?: string;
    fileNames?: string[];
    importedAt?: string;
    pageCount?: number;
    edition?: string;
    coverImageDataUrl?: string;
  };
  lessons: LessonContent[];
  questions: StudyQuestion[];
};

type ContentContextValue = {
  course: RuntimeCourse;
  courses: RuntimeCourse[];
  activeCourseId: string;
  hydrated: boolean;
  getLesson: (lessonId: number) => LessonContent | null;
  replaceCourse: (course: RuntimeCourse) => void;
  selectCourse: (courseId: string) => void;
  resetCourse: () => void;
};

const LEGACY_STORAGE_KEY = "haneul-course-v2";
const FALLBACK_STORAGE_KEY = "haneul-course-fallback-v1";
const ACTIVE_COURSE_ID_KEY = "haneul-active-course-id-v1";

const emptyRuntimeCourse: RuntimeCourse = {
  id: "empty",
  title: "",
  level: "",
  lessons: [],
  questions: [],
};

const ContentContext = createContext<ContentContextValue | null>(null);

function isRuntimeCourse(value: unknown): value is RuntimeCourse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.level === "string" &&
    Array.isArray(record.lessons) &&
    Array.isArray(record.questions)
  );
}

function isPersistableCourse(value: unknown): value is RuntimeCourse {
  return isRuntimeCourse(value) && value.id !== "beginner-1" && value.lessons.length > 0;
}

function readLocalFallback() {
  for (const key of [FALLBACK_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed: unknown = JSON.parse(raw);
      if (isPersistableCourse(parsed)) return parsed;
    } catch {
      // Try the next storage source.
    }
  }

  return null;
}

async function readServerLibrary() {
  try {
    const response = await fetch("/api/courses", { cache: "no-store" });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      courses?: unknown[];
      activeCourseId?: unknown;
    };
    const courses = Array.isArray(data.courses)
      ? data.courses.filter(isPersistableCourse)
      : [];
    if (!courses.length) return null;

    return {
      courses,
      activeCourseId:
        typeof data.activeCourseId === "string"
          ? data.activeCourseId
          : courses[0].id,
    };
  } catch {
    return null;
  }
}

async function restoreCourse() {
  const serverLibrary = await readServerLibrary();

  if (serverLibrary) {
    let preferredId: string | null = null;
    try {
      preferredId = window.localStorage.getItem(ACTIVE_COURSE_ID_KEY);
    } catch {
      preferredId = null;
    }

    // On first migration, preserve the course the learner was already using
    // so legacy progress is attached to the correct level.
    if (!preferredId) {
      try {
        const cached = await readStoredCourse();
        if (
          isPersistableCourse(cached) &&
          serverLibrary.courses.some((item) => item.id === cached.id)
        ) {
          preferredId = cached.id;
        }
      } catch {
        // Fall back to the server's active course.
      }
    }

    const selected =
      serverLibrary.courses.find((item) => item.id === preferredId) ??
      serverLibrary.courses.find(
        (item) => item.id === serverLibrary.activeCourseId,
      ) ??
      serverLibrary.courses[0];

    try {
      await writeStoredCourse(selected);
      window.localStorage.setItem(ACTIVE_COURSE_ID_KEY, selected.id);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
    } catch {
      // Runtime state can still use server data.
    }

    return { course: selected, courses: serverLibrary.courses };
  }

  try {
    const stored = await readStoredCourse();
    if (isPersistableCourse(stored)) {
      return { course: stored, courses: [stored] };
    }
  } catch {
    // IndexedDB can be unavailable in restricted browser modes.
  }

  const fallback = readLocalFallback();
  return fallback ? { course: fallback, courses: [fallback] } : null;
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [course, setCourse] = useState<RuntimeCourse>(emptyRuntimeCourse);
  const [courses, setCourses] = useState<RuntimeCourse[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void restoreCourse()
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setCourse(restored.course);
          setCourses(restored.courses);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || course.id === "empty") return;

    try {
      window.localStorage.setItem(ACTIVE_COURSE_ID_KEY, course.id);
    } catch {
      // Selection persistence is optional.
    }

    void writeStoredCourse(course).catch(() => {
      try {
        window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(course));
      } catch {
        // The UI remains usable even when browser persistence is unavailable.
      }
    });
  }, [course, hydrated]);

  const value = useMemo<ContentContextValue>(() => ({
    course,
    courses,
    activeCourseId: course.id,
    hydrated,
    getLesson(lessonId) {
      return course.lessons.find((lesson) => lesson.id === lessonId) ?? null;
    },
    replaceCourse(nextCourse) {
      setCourses((current) => [
        nextCourse,
        ...current.filter((item) => item.id !== nextCourse.id),
      ]);
      setCourse(nextCourse);
    },
    selectCourse(courseId) {
      const nextCourse = courses.find((item) => item.id === courseId);
      if (nextCourse) setCourse(nextCourse);
    },
    resetCourse() {
      setCourse(emptyRuntimeCourse);
      setCourses([]);
      void clearStoredCourse().catch(() => undefined);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_COURSE_ID_KEY);
    },
  }), [course, courses, hydrated]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used inside ContentProvider");
  return context;
}
