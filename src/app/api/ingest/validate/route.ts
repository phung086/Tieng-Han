import { NextResponse } from "next/server";
import { callContentModel, callVisionContentModel, type InputContent } from "@/lib/content-ai";
import { ingestionConfig } from "@/config/ingestion";
import {
  defaultLanguageProfile,
  type LanguageProfile,
} from "@/lib/language-profile";

export const maxDuration = 120;

type SourcePage = {
  fileName: string;
  pageNumber: number;
  text: string;
  imageDataUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lesson?: unknown;
      questions?: unknown;
      pages?: SourcePage[];
      language?: LanguageProfile;
    };

    const pages = body.pages ?? [];
    const language = body.language ?? defaultLanguageProfile;
    if (!body.lesson || !pages.length) {
      return NextResponse.json({ error: "Thiếu lesson hoặc source pages." }, { status: 400 });
    }

    let source = "";
    for (const page of pages) {
      const next = `[SOURCE: ${page.fileName} · p.${page.pageNumber}]\n${page.text}\n\n`;
      if ((source + next).length > 75_000) break;
      source += next;
    }

    const instructions = [
      "Bạn là QA validator cho dữ liệu học ngôn ngữ sinh từ giáo trình.",
      "Ngôn ngữ đích: " +
        language.targetName +
        " (" +
        language.target +
        "). Ngôn ngữ người học: " +
        language.learnerName +
        " (" +
        language.learner +
        ").",
      "So sánh GENERATED với SOURCE, không bổ sung kiến thức mới.",
      "Nếu có SOURCE PAGE IMAGE, phải dùng cả hình ảnh để kiểm tra nội dung thị giác, bảng, tranh minh họa và chữ mà text extraction có thể bỏ sót.",
      "Đánh giá hai tiêu chí 0-100:",
      "- coverageScore: dữ liệu đã bao phủ từ vựng, ngữ pháp, nghe/nói, đọc/viết, hội thoại, phát âm, văn hóa và các mục/hoạt động quan trọng của nguồn đến đâu.",
      "- groundingScore: các nội dung generated có thực sự được hỗ trợ bởi nguồn hay có hallucination.",
      "Câu hỏi luyện tập mới được phép paraphrase/tạo distractor, nhưng đáp án/kiến thức phải bám nguồn.",
      "Kiểm tra thêm tính sẵn sàng học: lesson cần có vocabulary/grammar theo nguồn và practice đủ Nghe, Nói, Đọc, Viết. Phần Đọc/Viết được phép derived từ chính nội dung nguồn nếu sách không có section riêng, nhưng không được thêm curriculum mới.",
      "Không coi field legacy ko/vi là bằng chứng ngôn ngữ; chúng chỉ là alias runtime. Đánh giá nội dung theo language profile và source.",
      "Trả JSON duy nhất:",
      '{"coverageScore":0,"groundingScore":0,"issues":["..."],"missingTopics":["..."],"pass":true}',
      "pass chỉ true khi coverageScore >= " +
        ingestionConfig.validation.passCoverage +
        " và groundingScore >= " +
        ingestionConfig.validation.passGrounding +
        " và không có lỗi nghiêm trọng.",
    ].join("\n");

    const generatedText =
      "SOURCE:\n" +
      source +
      "\n\nGENERATED LESSON:\n" +
      JSON.stringify(body.lesson) +
      "\n\nGENERATED QUESTIONS:\n" +
      JSON.stringify(body.questions ?? []);

    const visualPages = pages
      .filter((page) => Boolean(page.imageDataUrl))
      .slice(0, ingestionConfig.lesson.maxVisionPagesPerLesson);

    let result: unknown;

    if (visualPages.length) {
      const multimodal: InputContent[] = [
        {
          type: "input_text",
          text: generatedText,
        },
      ];

      for (const page of visualPages) {
        multimodal.push(
          {
            type: "input_text",
            text:
              "SOURCE PAGE IMAGE: " +
              page.fileName +
              " · p." +
              page.pageNumber,
          },
          {
            type: "input_image",
            image_url: page.imageDataUrl,
            detail: "high",
          },
        );
      }

      result = await callVisionContentModel(instructions, multimodal);
    } else {
      result = await callContentModel(instructions, generatedText);
    }

    const raw = result as Record<string, unknown>;
    const coverageScore = Math.max(0, Math.min(100, Number(raw.coverageScore) || 0));
    const groundingScore = Math.max(0, Math.min(100, Number(raw.groundingScore) || 0));
    const issues = Array.isArray(raw.issues) ? raw.issues.map(String).slice(0, 20) : [];
    const missingTopics = Array.isArray(raw.missingTopics) ? raw.missingTopics.map(String).slice(0, 20) : [];
    const pass =
      Boolean(raw.pass) &&
      coverageScore >= ingestionConfig.validation.passCoverage &&
      groundingScore >= ingestionConfig.validation.passGrounding;

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
