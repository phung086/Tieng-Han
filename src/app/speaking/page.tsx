import { SpeakingLab } from "@/components/speaking-lab";

export default async function SpeakingPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="page"><SpeakingLab lessonId={Number(lesson ?? 1)} /></div>;
}
