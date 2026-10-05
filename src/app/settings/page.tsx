import { SettingsClient } from "@/components/settings-client";
import { viMessages } from "@/i18n/vi";

export default function SettingsPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">{viMessages.settings.kicker}</span>
          <h1>{viMessages.settings.title}</h1>
          <p>{viMessages.settings.intro}</p>
        </div>
      </header>
      <SettingsClient />
    </div>
  );
}
