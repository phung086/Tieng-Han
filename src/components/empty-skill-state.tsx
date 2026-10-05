"use client";

import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { useMessages } from "@/i18n/messages";

export function EmptySkillState({
  lessonId,
  skill,
}: {
  lessonId: number;
  skill: string;
}) {
  const messages = useMessages();

  return (
    <div className="empty-skill-state">
      <div className="empty-skill-icon"><BookOpenText size={28} /></div>
      <span className="eyebrow">{messages.emptySkill.eyebrow}</span>
      <h1>{skill} · {messages.common.lesson} {lessonId}</h1>
      <p>{messages.emptySkill.body}</p>
      <Link className="secondary-button" href={"/learn/" + lessonId}>
        {messages.emptySkill.back}
      </Link>
    </div>
  );
}
