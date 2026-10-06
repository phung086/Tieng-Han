import { PronunciationLab } from "@/components/pronunciation-lab";

export default async function PronunciationPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;
  return (
    <div className="page">
      <PronunciationLab lessonId={Number(lesson ?? 1)} />
    </div>
  );
}
