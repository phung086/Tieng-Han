import { SourceReader } from "@/components/source-reader";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ page?: string; document?: string }> }) {
  const query = await searchParams;
  const number = Number(query.page ?? 1);
  return <div className="page"><SourceReader initialPage={Number.isSafeInteger(number) && number > 0 ? number : 1} initialDocument={query.document} /></div>;
}
