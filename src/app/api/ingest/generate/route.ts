import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/api-guard";
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
  const denied = await requireAdminApiAccess(request, { mutation: true });
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      lessonId?: number;
      pages?: SourcePage[];
      revisionNotes?: string[];
      language?: LanguageProfile;
    };

    const lessonId = Number(body.lessonId);
    const language = body.language ?? defaultLanguageProfile;
    const pages = body.pages ?? [];
    const revisionNotes = (body.revisionNotes ?? []).map(String).slice(0, 20);

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
        targetTitle: "target-language lesson title",
        learnerTitle: "short learner-language title",
        objective: "learning objective in learner language",
        vocabulary: [
          {
            id: "unique-id",
            targetText: "source word or phrase",
            learnerMeaning: "meaning in learner language",
            example: "source-based example",
            sourceRef: "file · p.1",
          },
        ],
        grammar: [
          {
            id: "unique-id",
            pattern: "source grammar pattern",
            meaning: "meaning in learner language",
            explanation: "explanation in learner language",
            examples: ["..."],
            sourceRef: "file · p.1",
          },
        ],
        listening: [
          {
            id: "unique-id",
            text: "only if transcript/source exists or source-derived TTS",
            meaning: "meaning in learner language",
            choices: ["4 learner-language choices"],
            answer: "one exact choice",
            sourceRef: "file · p.1",
          },
        ],
        speaking: ["source-based target-language sentences or prompts"],
        dialogues: [
          {
            id: "unique-id",
            title: "...",
            lines: [
              {
                speaker: "A",
                targetText: "...",
                learnerMeaning: "...",
              },
            ],
            sourceRef: "file · p.1",
          },
        ],
        pronunciation: [
          {
            id: "unique-id",
            title: "...",
            explanation: "...",
            examples: ["..."],
            sourceRef: "file · p.1",
          },
        ],
        culture: [
          {
            id: "unique-id",
            title: "...",
            text: "...",
            sourceRef: "file · p.1",
          },
        ],
        extraSections: [
          {
            id: "unique-id",
            kind: "practice|note|culture|other",
            title: "...",
            content: ["..."],
            sourceRef: "file · p.1",
          },
        ],
        reading: {
          title: "...",
          text: "...",
          translation: "...",
          questions: [
            {
              id: "unique-id",
              q: "...",
              choices: ["3 choices"],
              answer: "...",
              sourceRef: "file · p.1",
            },
          ],
          sourceRef: "file · p.1",
        },
        writing: {
          prompt: "...",
          hint: "...",
          targetWords: ["..."],
          sourceRef: "file · p.1",
        },
        sourceRef: "page range",
      },
      questions: [
        {
          id: "unique-id",
          lessonId,
          skill:
            "vocabulary|grammar|listening|speaking|reading|writing",
          type: "choice|input|reorder",
          title: "...",
          prompt: "...",
          translation: "...",
          choices: ["..."],
          tokens: ["..."],
          answer: "...",
          explanation: "...",
          sourceRef: "file · p.1",
        },
      ],
    };

    const instructions = [
      "Bạn là content compiler cho ứng dụng học ngôn ngữ.",
      "Ngôn ngữ đích: " +
        language.targetName +
        " (" +
        language.target +
        ", locale " +
        language.locale +
        ").",
      "Ngôn ngữ giải thích cho người học: " +
        language.learnerName +
        " (" +
        language.learner +
        ").",
      "Mục tiêu là chuyển NỘI DUNG CÓ TRONG NGUỒN thành dữ liệu học tập, không viết một giáo trình mới.",
      "Các ảnh SOURCE PAGE IMAGE là một phần của nguồn. Hãy đọc chữ trong ảnh, tranh minh họa, bảng, sơ đồ và quan hệ hình-nghĩa khi chúng cung cấp kiến thức mà text extraction bỏ sót.",
      "QUY TẮC NGHIÊM NGẶT:",
      "1. Chỉ trích xuất kiến thức xuất hiện trong các trang nguồn.",
      "2. Không tự thêm chủ điểm từ vựng/ngữ pháp không có trong bài.",
      "3. Mỗi mục phải có sourceRef theo marker SOURCE gần nhất.",
      "4. Có thể tạo câu hỏi luyện tập mới nhưng kiến thức và đáp án phải suy ra trực tiếp từ nguồn.",
      "5. Distractor có thể được tạo để làm MCQ nhưng không được giới thiệu kiến thức mới.",
      "6. Với listening: ưu tiên transcript/câu nghe có trong nguồn. Nếu PDF chỉ có hội thoại/ví dụ mà không có transcript audio, được phép tạo bài nghe TTS từ CHÍNH các câu có trong nguồn; không sáng tác cấu trúc mới.",
      "7. ỨNG DỤNG BẮT BUỘC có practice cho đủ 6 kỹ năng. Nếu nguồn không có mục Đọc/Viết riêng, hãy tạo một bài practice NGẮN chỉ từ từ vựng, ngữ pháp, hội thoại hoặc câu ví dụ đã có trong nguồn. Không thêm chủ đề/kiến thức mới. sourceRef phải ghi rõ Derived from <nguồn trang>.",
      "8. Cố gắng bao phủ TOÀN BỘ từ vựng và điểm ngữ pháp của bài, không chỉ lấy vài ví dụ.",
      "9. speaking phải có các câu/prompt luyện nói lấy nguyên hoặc biến đổi tối thiểu từ câu có trong nguồn; tuyệt đối không thêm mẫu ngữ pháp ngoài bài.",
      "10. BẮT BUỘC giữ các phần khác của sách nếu có: hội thoại, phát âm, văn hóa, ghi chú, luyện tập hoặc mục đặc biệt.",
      "11. Giữ nguyên text ngôn ngữ đích trong targetTitle/targetText và viết giải thích, meaning, learnerTitle bằng ngôn ngữ người học.",
      "12. Dùng canonical fields targetTitle, learnerTitle, targetText, learnerMeaning. Không hardcode field theo tên một ngôn ngữ cụ thể.",
      "13. Sinh 8-20 questions tùy lượng nội dung, phân bố nhiều dạng choice/input/reorder và ưu tiên đủ các skill có thể kiểm tra bằng quiz.",
      "Trả về DUY NHẤT một JSON object, không markdown.",
      "Hình dạng JSON tham chiếu:",
      revisionNotes.length
        ? "FEEDBACK TỪ VÒNG QA TRƯỚC - bắt buộc sửa: " +
          revisionNotes.join(" | ")
        : "Không có feedback vòng trước.",
      JSON.stringify(schema),
    ].join("\n");

    const visualPages = pages
      .filter((page) => Boolean(page.imageDataUrl))
      .slice(0, ingestionConfig.lesson.maxVisionPagesPerLesson);

    let result: unknown;

    if (visualPages.length) {
      const multimodal: InputContent[] = [
        {
          type: "input_text",
          text: source,
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
      result = await callContentModel(instructions, source);
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể sinh nội dung bài học." },
      { status: 500 },
    );
  }
}
