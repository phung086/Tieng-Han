"use client";

import Link from "next/link";
import { BookOpenText, FileUp, Settings } from "lucide-react";
import { useMessages } from "@/i18n/messages";

export function EmptyCourseState({ compact = false }: { compact?: boolean }) {
  const messages = useMessages();

  return (
    <section className={compact ? "empty-course-state compact" : "empty-course-state"}>
      <div className="empty-course-visual">
        <BookOpenText size={32} />
        <span>+</span>
        <FileUp size={25} />
      </div>
      <span className="eyebrow">{messages.onboarding.eyebrow}</span>
      <h1>{messages.onboarding.title}</h1>
      <p>{messages.onboarding.body}</p>
      <div className="empty-course-actions">
        <Link className="primary-button" href="/import">
          <FileUp size={17} /> {messages.onboarding.action}
        </Link>
        <Link className="secondary-button" href="/settings">
          <Settings size={16} /> {messages.onboarding.secondary}
        </Link>
      </div>
    </section>
  );
}
