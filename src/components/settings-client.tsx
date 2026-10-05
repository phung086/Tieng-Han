"use client";

import Link from "next/link";
import { Database, FileUp, RotateCcw, ShieldCheck } from "lucide-react";
import { useLearning } from "@/lib/learning-state";
import { useContent } from "@/lib/content-store";
import { useMessages } from "@/i18n/messages";

export function SettingsClient() {
  const { state, resetProgress } = useLearning();
  const { course, resetCourse } = useContent();
  const messages = useMessages();

  function resetAll() {
    if (!window.confirm(messages.settings.resetConfirm)) return;
    resetProgress();
    resetCourse();
  }

  return (
    <div className="settings-stack">
      <section className="settings-card">
        <div className="settings-icon"><Database size={21} /></div>
        <div>
          <h2>{messages.settings.localData}</h2>
          <p>{messages.settings.localDataBody}</p>
        </div>
        <span className="settings-badge">{state.xp} XP</span>
      </section>

      <section className="settings-card">
        <div className="settings-icon"><FileUp size={21} /></div>
        <div>
          <h2>{messages.settings.importTitle}</h2>
          <p>{messages.settings.importBody}</p>
        </div>
        <Link className="secondary-button" href="/import">
          {messages.settings.openImport}
        </Link>
      </section>

      <section className="settings-card">
        <div className="settings-icon"><ShieldCheck size={21} /></div>
        <div>
          <h2>{messages.settings.currentCourse}</h2>
          <p>
            {course.title} · {course.lessons.length} {messages.learn.lessons}.{" "}
            {messages.settings.apiBody}
          </p>
        </div>
        <span className="settings-badge good">
          {messages.settings.localFirst}
        </span>
      </section>

      <section className="settings-card danger-zone">
        <div className="settings-icon"><RotateCcw size={21} /></div>
        <div>
          <h2>{messages.settings.resetAll}</h2>
          <p>{messages.settings.resetBody}</p>
        </div>
        <button className="secondary-button" onClick={resetAll}>
          {messages.settings.resetButton}
        </button>
      </section>
    </div>
  );
}
