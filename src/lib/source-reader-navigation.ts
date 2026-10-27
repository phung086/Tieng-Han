export type SourceReaderLocation = {
  page: number;
  documentId: string;
};

export function parseSourceReaderLocation(href: string): SourceReaderLocation {
  const url = new URL(href, "http://localhost");
  const candidate = Number(url.searchParams.get("page") ?? "1");
  return {
    page: Number.isSafeInteger(candidate) && candidate > 0 ? candidate : 1,
    documentId: url.searchParams.get("document") ?? "",
  };
}

export function buildSourceReaderHref(
  href: string,
  page: number,
  documentId: string,
): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.set(
    "page",
    String(Number.isSafeInteger(page) && page > 0 ? page : 1),
  );
  if (documentId) url.searchParams.set("document", documentId);
  else url.searchParams.delete("document");
  return url.pathname + url.search + url.hash;
}
