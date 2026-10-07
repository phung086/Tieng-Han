import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { callVisionContentModel } from "@/lib/content-ai";

type OcrPage = {
  fileName: string;
  pageNumber: number;
  imageDataUrl: string;
};

export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess(request, { mutation: true });
  if (denied) return denied;

  try {
    const body = (await request.json()) as { pages?: OcrPage[] };
    const pages = (body.pages ?? []).slice(0, 4);

    if (!pages.length) {
      return NextResponse.json({ error: "Không có ảnh trang để OCR." }, { status: 400 });
    }

    const content = [
      {
        type: "input_text" as const,
        text: [
          "OCR chính xác các trang giáo trình tiếng Hàn dưới đây.",
          "Giữ nguyên Hangul, số, ký hiệu ngữ pháp và tiếng Việt/Anh nếu có.",
          "Không dịch, không tóm tắt, không sửa nội dung.",
          "Trả JSON duy nhất dạng:",
          '{"pages":[{"pageNumber":1,"text":"toàn bộ text đọc được"}]}',
          "Số pageNumber phải đúng theo nhãn PAGE trong lời nhắc trước từng ảnh.",
        ].join("\n"),
      },
      ...pages.flatMap((page) => [
        {
          type: "input_text" as const,
          text: `FILE: ${page.fileName} · PAGE: ${page.pageNumber}`,
        },
        {
          type: "input_image" as const,
          image_url: page.imageDataUrl,
          detail: "high" as const,
        },
      ]),
    ];

    const result = await callVisionContentModel(
      "Bạn là OCR engine cho giáo trình tiếng Hàn. Mục tiêu là transcription trung thực theo từng trang, không sáng tác.",
      content,
    );

    const raw = result as { pages?: unknown[] };
    const parsed = Array.isArray(raw.pages)
      ? raw.pages
          .map((item) => {
            const row = item as Record<string, unknown>;
            return {
              pageNumber: Number(row.pageNumber),
              text: String(row.text ?? "").trim(),
            };
          })
          .filter((item) => Number.isFinite(item.pageNumber))
      : [];

    return NextResponse.json({ pages: parsed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể OCR tài liệu." },
      { status: 500 },
    );
  }
}
