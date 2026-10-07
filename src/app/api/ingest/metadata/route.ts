import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { callContentModel } from "@/lib/content-ai";
import {
  defaultLanguageProfile,
  type LanguageProfile,
} from "@/lib/language-profile";

export const maxDuration = 120;

type PageInput = {
  fileName: string;
  pageNumber: number;
  text: string;
};

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess(request, { mutation: true });
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      pages?: PageInput[];
      language?: LanguageProfile;
    };
    const pages = (body.pages ?? []).slice(0, 16);
    const language = body.language ?? defaultLanguageProfile;

    if (!pages.length) {
      return NextResponse.json(
        { error: "Không có trang để nhận diện sách." },
        { status: 400 },
      );
    }

    const source = pages
      .map(
        (page) =>
          `[PAGE ${page.pageNumber}]\n${page.text.slice(0, 3500)}`,
      )
      .join("\n\n");

    const result = await callContentModel(
      [
        "Nhận diện metadata của giáo trình ngôn ngữ từ các trang đầu sách.",
        "Ngôn ngữ đích dự kiến: " +
          language.targetName +
          " (" +
          language.target +
          ").",
        "Không đoán nếu không có bằng chứng rõ ràng.",
        "Trả JSON duy nhất:",
        '{"title":"tên sách","level":"cấp độ như Beginner 1 / HSK 1 / sơ cấp tùy sách","edition":"năm hoặc bản nếu thấy, nếu không thì chuỗi rỗng"}',
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể nhận diện metadata.",
      },
      { status: 500 },
    );
  }
}
