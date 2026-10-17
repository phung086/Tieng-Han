import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
import { callContentModel, callVisionContentModel, type InputContent } from "@/lib/content-ai";
import { ingestionConfig } from "@/config/ingestion";
import { acceptsFullSourceValidation, prepareSourceRequest } from "@/lib/source-request";
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
  const denied = await requireAdminApiAccess(request, { mutation: true });
  if (denied) return denied;

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

    const { source, visualPages } = prepareSourceRequest(pages, 75_000, ingestionConfig.lesson.maxVisionPagesPerLesson);

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
      "Kiểm kê từng đơn vị và từng ý nhỏ trên TẤT CẢ trang nguồn. Bất kỳ từ, ví dụ, hội thoại, đề bài, lựa chọn, bài đọc, nhiệm vụ, phát âm, văn hóa hoặc hình/bảng học tập nào bị thiếu đều phải nằm trong missingTopics; không được cho pass khi thiếu dù chỉ một mục. Bản chép nguyên trang là bản dự phòng nguồn, không phải bằng chứng mục đó đã được biên soạn thành kiến thức/bài tập. Không yêu cầu kỹ năng không có trong nguồn.",
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
    const validScore = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
    const coverageScore = validScore(raw.coverageScore) ? raw.coverageScore : 0;
    const groundingScore = validScore(raw.groundingScore) ? raw.groundingScore : 0;
    const issues = Array.isArray(raw.issues) ? raw.issues.map(String) : ["QA không trả danh sách issues hợp lệ."];
    const missingTopics = Array.isArray(raw.missingTopics) ? raw.missingTopics.map(String) : ["QA không trả kiểm kê phần thiếu hợp lệ."];
    const pass = acceptsFullSourceValidation({ pass: raw.pass === true, coverageScore, groundingScore, issues, missingTopics });

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
      { status: error instanceof RangeError ? 413 : 500 },
    );
  }
}
