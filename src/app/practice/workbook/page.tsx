import { SourceWorkbook } from "@/components/source-workbook";

export default async function SourceWorkbookPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const params = await searchParams;
  const id = Number(params.lesson);
  return (
    <div className="page">
      <SourceWorkbook lessonId={Number.isFinite(id) && id > 0 ? id : 1} />
    </div>
  );
}
