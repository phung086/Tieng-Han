"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { course as demoCourse, type LessonContent } from "@/data/content";

export type RuntimeCourse = {
  id: string;
  title: string;
  level: string;
  source?: {
    fileName?: string;
    importedAt?: string;
    pageCount?: number;
    edition?: string;
  };
  lessons: LessonContent[];
};

type ContentContextValue = {
  course: RuntimeCourse;
  hydrated: boolean;
  getLesson: (lessonId: number) => LessonContent | null;
  replaceCourse: (course: RuntimeCourse) => void;
  resetCourse: () => void;
};

const STORAGE_KEY = "haneul-course-v1";
const ContentContext = createContext<ContentContextValue | null>(null);

function isRuntimeCourse(value: unknown): value is RuntimeCourse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.level === "string" &&
    Array.isArray(record.lessons)
  );
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [course, setCourse] = useState<RuntimeCourse>(demoCourse);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let savedCourse: RuntimeCourse | null = null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isRuntimeCourse(parsed)) savedCourse = parsed;
      }
    } catch {
      // Keep the bundled demo course if local content cannot be restored.
    }

    const timer = window.setTimeout(() => {
      if (savedCourse) setCourse(savedCourse);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
  }, [course, hydrated]);

  const value = useMemo<ContentContextValue>(() => ({
    course,
    hydrated,
    getLesson(lessonId) {
      return course.lessons.find((lesson) => lesson.id === lessonId) ?? null;
    },
    replaceCourse(nextCourse) {
      setCourse(nextCourse);
    },
    resetCourse() {
      setCourse(demoCourse);
      window.localStorage.removeItem(STORAGE_KEY);
    },
  }), [course, hydrated]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used inside ContentProvider");
  return context;
}
