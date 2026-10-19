"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-client";
import { useContent } from "@/lib/content-store";
import { progressStorageKey } from "@/lib/progress-persistence";
import {useLearning} from "@/lib/learning-state";
import {readPracticeSession,writePracticeSession} from "@/lib/practice-session-storage";

export function useWritingDraft(lessonId: number) {
  const { user } = useAuth();
  const { activeCourseId } = useContent();
  const {state,progressScope,savePracticeSession}=useLearning();
  const key = progressStorageKey(activeCourseId, user?.id) + ":writing-draft:" + lessonId;
  const [text, setText] = useState(() => {
    try { return typeof window === "undefined" ? "" : readPracticeSession(state,window.localStorage,progressScope,key) ?? window.localStorage.getItem(key) ?? ""; } catch { return ""; }
  });
  function save(value:string|((current:string)=>string)){const next=typeof value==="function"?value(text):value;setText(next);savePracticeSession(key,next);try{writePracticeSession(window.localStorage,progressScope,key,next);}catch{/* Editing remains usable. */}}
  return [text, save] as const;
}
