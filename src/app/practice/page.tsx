"use client";

import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, Headphones, Layers3, Mic2, PenLine, Sparkles } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { useMessages } from "@/i18n/messages";
import { EmptyCourseState } from "@/components/empty-course-state";

const modeKeys = [
  { path: "/practice/quiz", key: "mixed", icon: Sparkles, tone: "violet" },
  { path: "/vocabulary", key: "vocabulary", icon: Layers3, tone: "blue" },
  { path: "/listening", key: "listening", icon: Headphones, tone: "mint" },
  { path: "/speaking", key: "speaking", icon: Mic2, tone: "coral" },
  { path: "/reading", key: "reading", icon: BookOpenText, tone: "amber" },
  { path: "/writing", key: "writing", icon: PenLine, tone: "rose" },
] as const

export default function PracticePage() {
  const { state } = useLearning();
  const { course } = useContent();
  const messages = useMessages();
  if (!course.lessons.length) {
    return (
      <div className="page">
        <EmptyCourseState compact />
      </div>
    );
  }

  const current =
    course.lessons.find((lesson) => (state.lessonProgress[String(lesson.id)] ?? 0) < 100) ??
    course.lessons[course.lessons.length - 1];

  return (
    <div className="page">
      <header className="page-header compact">
        <div><span className="kicker">{messages.practice.kicker}</span><h1>{messages.practice.title}</h1><p>{messages.practice.currentLessonPrefix} {current.id} {messages.practice.currentLessonSuffix}</p></div>
      </header>

      <section className="practice-feature">
        <div>
          <span className="pill pill-soft">{messages.practice.suggested}</span>
          <h2>{messages.practice.mixedSession} · {messages.common.lesson} {current.id}</h2>
          <p>{current.title} · {current.objective}</p>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + current.id}>{messages.practice.start} <ArrowRight size={18} /></Link>
        </div>
        <div className="practice-brain"><Brain size={48} /></div>
      </section>

      <section className="practice-mode-grid">
        {modeKeys.map(({ path, key, icon: Icon, tone }) => { const mode = messages.practice.modes[key]; return (
          <Link className={"practice-mode tone-" + tone} href={path + "?lesson=" + current.id} key={path}>
            <div className="practice-mode-icon"><Icon size={23} /></div>
            <span>{mode.ko}</span><h2>{mode.title}</h2><p>{mode.desc}</p><div className="mode-arrow"><ArrowRight size={17} /></div>
          </Link>
        ); })}
      </section>
    </div>
  );
}
