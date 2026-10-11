import { TextbookDrills } from "@/components/textbook-drills";

export default async function TextbookDrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;
  const parsed = Number(lesson);
  return <TextbookDrills requestedLessonId={Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined} />;
}
