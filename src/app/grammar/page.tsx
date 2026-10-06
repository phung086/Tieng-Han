import { GrammarLab } from "@/components/grammar-lab";

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;

  return (
    <div className="page">
      <GrammarLab lessonId={Number(lesson ?? 1)} />
    </div>
  );
}
