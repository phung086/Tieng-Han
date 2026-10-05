import { ReadingLab } from "@/components/reading-lab";

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="page"><ReadingLab lessonId={Number(lesson ?? 1)} /></div>;
}
