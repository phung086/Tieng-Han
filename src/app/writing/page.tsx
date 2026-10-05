import { WritingLab } from "@/components/writing-lab";

export default async function WritingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="page"><WritingLab lessonId={Number(lesson ?? 3)} /></div>;
}
