import { ActiveCourseChip } from "@/components/active-course-chip";
import { StatsClient } from "@/components/stats-client";
import { viMessages } from "@/i18n/vi";

export default function StatsPage() {
  return (
    <div className="page">
      <header className="page-header compact">
        <div>
          <span className="kicker">{viMessages.statsPage.kicker}</span>
          <h1>{viMessages.statsPage.title}</h1>
          <p>{viMessages.statsPage.intro}</p>
        </div>
      </header>
      <ActiveCourseChip />
      <StatsClient />
    </div>
  );
}
