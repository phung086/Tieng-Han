import { NextResponse } from "next/server";
import { resolveCourseSource, sourceHeaders } from "@/lib/course-source-access";
import { readImportPage } from "@/lib/import-job-store";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await context.params;
  const source = await resolveCourseSource(courseId);
  if ("error" in source) return NextResponse.json({ error: source.error }, { status: source.status, headers: sourceHeaders });
  const query = new URL(request.url).searchParams;
  const document = source.job.documents.find(item => item.documentId === (query.get("document") ?? source.job.documents[0]?.documentId));
  const pageNumber = Number(query.get("page"));
  if (!document || !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > document.pageCount) return NextResponse.json({ error: "Tài liệu hoặc trang không hợp lệ." }, { status: 400, headers: sourceHeaders });
  try {
    const page = await readImportPage(source.job.id, document.documentId, pageNumber);
    const imageId = query.get("image");
    const data = imageId ? page.embeddedImages?.find(item => item.id === imageId)?.dataUrl : page.previewImageDataUrl;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/\r\n]+={0,2})$/.exec(data ?? "");
    if (!match) return NextResponse.json({ error: "Chưa có ảnh nguồn hợp lệ cho trang này." }, { status: 404, headers: sourceHeaders });
    const bytes = Buffer.from(match[2], "base64");
    const valid = match[1] === "jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP";
    if (!valid) return NextResponse.json({ error: "Ảnh nguồn bị hỏng hoặc sai định dạng." }, { status: 422, headers: sourceHeaders });
    return new Response(new Uint8Array(bytes), { headers: { ...sourceHeaders, "Content-Type": "image/" + match[1], "Content-Length": String(bytes.length) } });
  } catch {
    return NextResponse.json({ error: "Không đọc được ảnh trang sách. Các trang khác vẫn có thể mở." }, { status: 404, headers: sourceHeaders });
  }
}
