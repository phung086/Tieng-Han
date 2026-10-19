"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-client";
import { useContent } from "@/lib/content-store";
import { progressStorageKey } from "@/lib/progress-persistence";

export function useWritingDraft(lessonId: number) {
  const { user } = useAuth();
  const { activeCourseId } = useContent();
  const key = progressStorageKey(activeCourseId, user?.id) + ":writing-draft:" + lessonId;
  const [text, setText] = useState(() => {
    try { return typeof window === "undefined" ? "" : window.localStorage.getItem(key) ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, text); } catch { /* The editor remains usable without storage. */ }
  }, [key, text]);
  return [text, setText] as const;
}
