import { ListeningLab } from "@/components/listening-lab";

export default async function ListeningPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="page"><ListeningLab lessonId={Number(lesson ?? 3)} /></div>;
}
