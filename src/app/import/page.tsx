import { redirect } from "next/navigation";
import { IngestionStudio } from "@/components/ingestion-studio";
import { getCurrentUser } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (isDatabaseConfigured()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login?next=/import");
    if (user.role !== "admin") redirect("/");
  }

  return (
    <div className="page">
      <IngestionStudio />
    </div>
  );
}
