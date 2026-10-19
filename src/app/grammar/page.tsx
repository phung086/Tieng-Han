import { GrammarLab } from "@/components/grammar-lab";

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;

  return (
    <div className="page">
      <GrammarLab key={lesson ?? "1"} lessonId={Number(lesson ?? 1)} />
    </div>
  );
}
