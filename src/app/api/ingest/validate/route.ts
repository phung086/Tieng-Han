import { NextResponse } from "next/server";
import { callContentModel } from "@/lib/content-ai";

type SourcePage = {
  fileName: string;
  pageNumber: number;
  text: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lesson?: unknown;
      questions?: unknown;
      pages?: SourcePage[];
    };

    const pages = body.pages ?? [];
    if (!body.lesson || !pages.length) {
      return NextResponse.json({ error: "Thiếu lesson hoặc source pages." }, { status: 400 });
    }

    let source = "";
    for (const page of pages) {
      const next = `[SOURCE: ${page.fileName} · p.${page.pageNumber}]\n${page.text}\n\n`;
      if ((source + next).length > 75_000) break;
      source += next;
    }

    const result = await callContentModel(
      [
        "Bạn là QA validator cho dữ liệu học tiếng Hàn sinh từ giáo trình.",
        "So sánh GENERATED với SOURCE, không bổ sung kiến thức mới.",
        "Đánh giá hai tiêu chí 0-100:",
        "- coverageScore: dữ liệu đã bao phủ từ vựng, ngữ pháp, nghe/nói, đọc/viết, hội thoại, phát âm, văn hóa và các mục/hoạt động quan trọng của nguồn đến đâu.",
        "- groundingScore: các nội dung generated có thực sự được hỗ trợ bởi nguồn hay có hallucination.",
        "Câu hỏi luyện tập mới được phép paraphrase/tạo distractor, nhưng đáp án/kiến thức phải bám nguồn.",
        "Trả JSON duy nhất:",
        '{"coverageScore":0,"groundingScore":0,"issues":["..."],"missingTopics":["..."],"pass":true}',
        "pass chỉ true khi coverageScore >= 82 và groundingScore >= 90 và không có lỗi nghiêm trọng.",
      ].join("\n"),
      `SOURCE:\n${source}\n\nGENERATED LESSON:\n${JSON.stringify(body.lesson)}\n\nGENERATED QUESTIONS:\n${JSON.stringify(body.questions ?? [])}`,
    );

    const raw = result as Record<string, unknown>;
    const coverageScore = Math.max(0, Math.min(100, Number(raw.coverageScore) || 0));
    const groundingScore = Math.max(0, Math.min(100, Number(raw.groundingScore) || 0));
    const issues = Array.isArray(raw.issues) ? raw.issues.map(String).slice(0, 20) : [];
    const missingTopics = Array.isArray(raw.missingTopics) ? raw.missingTopics.map(String).slice(0, 20) : [];
    const pass = Boolean(raw.pass) && coverageScore >= 82 && groundingScore >= 90;

    return NextResponse.json({
      coverageScore,
      groundingScore,
      issues,
      missingTopics,
      pass,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể validate nội dung." },
      { status: 500 },
    );
  }
}
