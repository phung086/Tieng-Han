import { z } from "zod";
import { formatSourcePages } from "@/lib/source-chunk-compilation";

export const sourceRequestPageSchema = z.object({
  fileName: z.string().trim().min(1),
  pageNumber: z.number().int().positive(),
  text: z.string(),
  imageDataUrl: z.string().optional(),
  sourceLocation: z.string().optional(),
  part: z.number().int().positive().optional(),
});

/** Request limits are batch limits. Reject oversized requests; never trim their sources. */
export function prepareSourceRequest(value: unknown, maxCharacters: number, maxImages: number) {
  const pages = z.array(sourceRequestPageSchema).min(1).parse(value);
  const source = formatSourcePages(pages);
  const visualPages = pages.filter(page => Boolean(page.imageDataUrl));
  if (source.length > maxCharacters || visualPages.length > maxImages) {
    throw new RangeError("Batch nguồn quá lớn. Hãy chia tiếp thành batch nhỏ và xử lý hết mọi phần; không được bỏ văn bản hoặc ảnh trang cuối.");
  }
  return { pages, source, visualPages };
}

export function acceptsFullSourceValidation(result: {
  pass: boolean; coverageScore: number; groundingScore: number;
  issues: string[]; missingTopics: string[];
}) {
  return result.pass && result.coverageScore === 100 && result.groundingScore === 100 &&
    result.issues.length === 0 && result.missingTopics.length === 0;
}
