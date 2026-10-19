import { VocabularyLab } from "@/components/vocabulary-lab";

export default async function VocabularyPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const { lesson } = await searchParams;
  return <div className="page"><VocabularyLab key={lesson ?? "1"} lessonId={Number(lesson ?? 1)} /></div>;
}
