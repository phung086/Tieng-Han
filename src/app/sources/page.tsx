import { SourceReader } from "@/components/source-reader";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const number = Number((await searchParams).page ?? 1);
  return <div className="page"><SourceReader initialPage={Number.isSafeInteger(number) && number > 0 ? number : 1} /></div>;
}
