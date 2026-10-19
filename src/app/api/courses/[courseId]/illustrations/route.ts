import sharp from "sharp";
import { resolveCourseSource, sourceHeaders } from "@/lib/course-source-access";
import { readImportPage } from "@/lib/import-job-store";
import { cropPixels, illustrationSchema } from "@/lib/learning-illustrations";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const source = await resolveCourseSource(courseId);
  if ("error" in source) return Response.json({ error: source.error }, { status: source.status, headers: sourceHeaders });
  const id = new URL(request.url).searchParams.get("id");
  const image = source.course.lessons.flatMap(lesson => lesson.illustrations ?? []).find(item => item.id === id);
  const parsed = illustrationSchema.safeParse(image);
  const document = source.job.documents.find(item => item.fileName === image?.fileName);
  if (!parsed.success || !document || parsed.data.pageNumber > document.pageCount) return Response.json({ error: "Không tìm thấy hình minh họa đã biên soạn." }, { status: 404, headers: sourceHeaders });
  try {
    const page = await readImportPage(source.job.id, document.documentId, parsed.data.pageNumber);
    const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/\r\n]+={0,2})$/.exec(page.previewImageDataUrl ?? "");
    if (!match) throw Error("Missing source pixels");
    const renderer = sharp(Buffer.from(match[1], "base64"), { limitInputPixels: 40_000_000 });
    const metadata = await renderer.metadata();
    if (!metadata.width || !metadata.height) throw Error("Missing source dimensions");
    const bytes = await renderer.extract(cropPixels(parsed.data.region, metadata.width, metadata.height)).jpeg({ quality: 90 }).toBuffer();
    return new Response(new Uint8Array(bytes), { headers: { ...sourceHeaders, "Content-Type": "image/jpeg", "Content-Length": String(bytes.length) } });
  } catch {
    return Response.json({ error: "Chưa tải được hình minh họa. Nội dung bài vẫn học được." }, { status: 404, headers: sourceHeaders });
  }
}
