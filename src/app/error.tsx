"use client";

import { useEffect } from "react";
import { useMessages } from "@/i18n/messages";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const messages = useMessages();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="system-state">
      <div className="brand-mark">ㅎ</div>
      <strong>{messages.system.error}</strong>
      <span>{messages.system.errorBody}</span>
      <button className="primary-button" onClick={reset}>
        {messages.system.retry}
      </button>
    </div>
  );
}
