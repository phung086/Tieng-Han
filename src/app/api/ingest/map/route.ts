import { NextResponse } from "next/server";
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
  try {
    const body = (await request.json()) as {
      pages?: PageInput[];
      language?: LanguageProfile;
    };
    const pages = (body.pages ?? []).slice(0, 40);
    const language = body.language ?? defaultLanguageProfile;

    if (!pages.length) {
      return NextResponse.json(
        { error: "Không có trang PDF để phân tích." },
        { status: 400 },
      );
    }

    const source = pages
      .map(
        (page) =>
          `[FILE: ${page.fileName}] [PAGE: ${page.pageNumber}]\n${page.text.slice(0, 2600)}`,
      )
      .join("\n\n");

    const result = await callContentModel(
      [
        "Bạn là bộ máy lập bản đồ giáo trình ngôn ngữ.",
        "Ngôn ngữ đích: " +
          language.targetName +
          " (" +
          language.target +
          ").",
        "Chỉ xác định nơi BÀI/LESSON/UNIT thực sự bắt đầu từ văn bản được cung cấp.",
        "Không bịa bài không xuất hiện trong nguồn.",
        "BẮT BUỘC bỏ qua mục lục, table of contents, index và trang chỉ liệt kê nhiều bài.",
        "Chỉ trả actual lesson opening page, nơi nội dung của bài thực sự bắt đầu.",
        "Nhận diện cả tiêu đề bản địa và các dạng Lesson 1, Unit 1, Bài 1 hoặc đánh số tương đương.",
        "Trả về JSON duy nhất theo dạng:",
        '{"starts":[{"lessonId":1,"pageNumber":12,"titleHint":"..."}]}',
        "Mỗi lessonId chỉ xuất hiện một lần trong batch.",
      ].join("\n"),
      source,
    );

    const raw = result as { starts?: unknown[] };
    const starts = Array.isArray(raw.starts)
      ? raw.starts
          .map((item) => {
            const row = item as Record<string, unknown>;
            return {
              lessonId: Number(row.lessonId),
              pageNumber: Number(row.pageNumber),
              titleHint: String(row.titleHint ?? ""),
            };
          })
          .filter(
            (item) =>
              Number.isFinite(item.lessonId) &&
              Number.isFinite(item.pageNumber),
          )
      : [];

    return NextResponse.json({ starts });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể phân tích cấu trúc sách.",
      },
      { status: 500 },
    );
  }
}
