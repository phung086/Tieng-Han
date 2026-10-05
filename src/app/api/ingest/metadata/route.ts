import { NextResponse } from "next/server";
import { callContentModel } from "@/lib/content-ai";

type PageInput = {
  fileName: string;
  pageNumber: number;
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pages?: PageInput[] };
    const pages = (body.pages ?? []).slice(0, 16);

    if (!pages.length) {
      return NextResponse.json({ error: "Không có trang để nhận diện sách." }, { status: 400 });
    }

    const source = pages
      .map((page) => `[PAGE ${page.pageNumber}]\n${page.text.slice(0, 3500)}`)
      .join("\n\n");

    const result = await callContentModel(
      [
        "Nhận diện metadata của giáo trình tiếng Hàn từ các trang đầu sách.",
        "Không đoán nếu không có bằng chứng rõ ràng.",
        "Trả JSON duy nhất:",
        '{"title":"tên sách","level":"cấp độ như 초급 1 / Beginner 1","edition":"năm/bản nếu thấy, nếu không thì chuỗi rỗng"}',
      ].join("\n"),
      source,
    );

    const row = result as Record<string, unknown>;

    return NextResponse.json({
      title: String(row.title ?? "").trim(),
      level: String(row.level ?? "").trim(),
      edition: String(row.edition ?? "").trim(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể nhận diện metadata." },
      { status: 500 },
    );
  }
}
