import { viMessages } from "@/i18n/vi";

export default function Loading() {
  return (
    <div className="system-state">
      <div className="system-spinner" />
      <strong>{viMessages.system.loading}</strong>
      <span>{viMessages.system.wait}</span>
    </div>
  );
}
