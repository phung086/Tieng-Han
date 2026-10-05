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
      lessonId?: number;
      pages?: SourcePage[];
    };

    const lessonId = Number(body.lessonId);
    const pages = body.pages ?? [];

    if (!lessonId || !pages.length) {
      return NextResponse.json({ error: "Thiếu lessonId hoặc nội dung nguồn." }, { status: 400 });
    }

    let source = "";
    for (const page of pages) {
      const next = `[SOURCE: ${page.fileName} · p.${page.pageNumber}]\n${page.text}\n\n`;
      if ((source + next).length > 90_000) break;
      source += next;
    }

    const schema = {
      lesson: {
        id: lessonId,
        title: "Korean lesson title",
        vi: "Vietnamese short title",
        objective: "Vietnamese learning objective",
        vocabulary: [{ id: "unique-id", ko: "학교", vi: "trường học", example: "source-based example", sourceRef: "file · p.1" }],
        grammar: [{ id: "unique-id", pattern: "N에 가다", meaning: "Vietnamese", explanation: "Vietnamese", examples: ["..."], sourceRef: "file · p.1" }],
        listening: [{ id: "unique-id", text: "only if transcript/source exists", meaning: "Vietnamese", choices: ["4 choices"], answer: "one exact choice", sourceRef: "file · p.1" }],
        speaking: ["source-based sentences or prompts"],
        reading: { title: "...", text: "...", translation: "...", questions: [{ id: "unique-id", q: "...", choices: ["3 choices"], answer: "...", sourceRef: "file · p.1" }], sourceRef: "file · p.1" },
        writing: { prompt: "...", hint: "...", targetWords: ["..."], sourceRef: "file · p.1" },
        sourceRef: "page range",
      },
      questions: [{
        id: "unique-id",
        lessonId,
        skill: "vocabulary|grammar|listening|speaking|reading|writing",
        type: "choice|input|reorder",
        title: "...",
        prompt: "...",
        translation: "...",
        choices: ["..."],
        tokens: ["..."],
        answer: "...",
        explanation: "...",
        sourceRef: "file · p.1",
      }],
    };

    const result = await callContentModel(
      [
        "Bạn là content compiler cho ứng dụng học tiếng Hàn của người Việt.",
        "Mục tiêu là chuyển NỘI DUNG CÓ TRONG NGUỒN thành dữ liệu học tập, không viết một giáo trình mới.",
        "QUY TẮC NGHIÊM NGẶT:",
        "1. Chỉ trích xuất kiến thức xuất hiện trong các trang nguồn.",
        "2. Không tự thêm chủ điểm từ vựng/ngữ pháp không có trong bài.",
        "3. Mỗi mục phải có sourceRef theo marker SOURCE gần nhất.",
        "4. Có thể tạo câu hỏi luyện tập mới nhưng kiến thức và đáp án phải suy ra trực tiếp từ nguồn.",
        "5. Distractor có thể được tạo để làm MCQ nhưng không được giới thiệu kiến thức mới.",
        "6. Không bịa transcript nghe. Nếu nguồn không có transcript/câu nghe rõ ràng, listening phải là [].",
        "7. Nếu không có bài đọc hoặc bài viết rõ ràng, đặt reading/writing là null.",
        "8. Cố gắng bao phủ TOÀN BỘ từ vựng và điểm ngữ pháp của bài, không chỉ lấy vài ví dụ.",
        "9. Giữ nguyên tiếng Hàn; phần giải thích/meaning viết tiếng Việt rõ ràng.",
        "10. Sinh 8-20 questions tùy lượng nội dung, phân bố nhiều dạng choice/input/reorder.",
        "Trả về DUY NHẤT một JSON object, không markdown.",
        "Hình dạng JSON tham chiếu:",
        JSON.stringify(schema),
      ].join("\n"),
      source,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể sinh nội dung bài học." },
      { status: 500 },
    );
  }
}
