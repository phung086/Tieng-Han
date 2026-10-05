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
  hydrated: boolean;
  getLesson: (lessonId: number) => LessonContent | null;
  replaceCourse: (course: RuntimeCourse) => void;
  resetCourse: () => void;
};

const LEGACY_STORAGE_KEY = "haneul-course-v2";
const FALLBACK_STORAGE_KEY = "haneul-course-fallback-v1";

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

async function restoreCourse() {
  try {
    const stored = await readStoredCourse();
    if (isPersistableCourse(stored)) return stored;
  } catch {
    // IndexedDB can be unavailable in restricted browser modes.
  }

  const fallback = readLocalFallback();

  if (fallback) {
    try {
      await writeStoredCourse(fallback);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Keep using the localStorage fallback.
    }
    return fallback;
  }

  try {
    const response = await fetch("/api/course", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { course?: unknown };
      if (isPersistableCourse(data.course)) {
        try {
          await writeStoredCourse(data.course);
        } catch {
          // Keep using the runtime data
        }
        return data.course;
      }
    }
  } catch {
    // Offline or server not reachable
  }

  return null;
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [course, setCourse] = useState<RuntimeCourse>(emptyRuntimeCourse);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void restoreCourse()
      .then((savedCourse) => {
        if (cancelled) return;
        if (savedCourse) setCourse(savedCourse);
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
    if (!hydrated) return;

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
    hydrated,
    getLesson(lessonId) {
      return course.lessons.find((lesson) => lesson.id === lessonId) ?? null;
    },
    replaceCourse(nextCourse) {
      setCourse(nextCourse);
    },
    resetCourse() {
      setCourse(emptyRuntimeCourse);
      void clearStoredCourse().catch(() => undefined);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
    },
  }), [course, hydrated]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw new Error("useContent must be used inside ContentProvider");
  return context;
}
