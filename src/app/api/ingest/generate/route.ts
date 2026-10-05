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
      revisionNotes?: string[];
    };

    const lessonId = Number(body.lessonId);
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
        title: "Korean lesson title",
        vi: "Vietnamese short title",
        objective: "Vietnamese learning objective",
        vocabulary: [{ id: "unique-id", ko: "학교", vi: "trường học", example: "source-based example", sourceRef: "file · p.1" }],
        grammar: [{ id: "unique-id", pattern: "N에 가다", meaning: "Vietnamese", explanation: "Vietnamese", examples: ["..."], sourceRef: "file · p.1" }],
        listening: [{ id: "unique-id", text: "only if transcript/source exists", meaning: "Vietnamese", choices: ["4 choices"], answer: "one exact choice", sourceRef: "file · p.1" }],
        speaking: ["source-based sentences or prompts"],
        dialogues: [{ id: "unique-id", title: "...", lines: [{ speaker: "A", ko: "...", vi: "..." }], sourceRef: "file · p.1" }],
        pronunciation: [{ id: "unique-id", title: "...", explanation: "...", examples: ["..."], sourceRef: "file · p.1" }],
        culture: [{ id: "unique-id", title: "...", text: "...", sourceRef: "file · p.1" }],
        extraSections: [{ id: "unique-id", kind: "practice|note|culture|other", title: "...", content: ["..."], sourceRef: "file · p.1" }],
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
        "6. Với listening: ưu tiên transcript/câu nghe có trong nguồn. Nếu PDF chỉ có nội dung hội thoại/ví dụ mà không có transcript audio, được phép tạo bài nghe TTS từ CHÍNH các câu có trong nguồn; không sáng tác cấu trúc mới.",
        "7. ỨNG DỤNG BẮT BUỘC có practice cho đủ 6 kỹ năng. Nếu nguồn không có mục Đọc/Viết riêng, hãy tạo một bài practice NGẮN chỉ từ từ vựng, ngữ pháp, hội thoại hoặc câu ví dụ đã có trong nguồn. Không thêm chủ đề/kiến thức mới. sourceRef phải ghi rõ Derived from <nguồn trang>. Chỉ dùng null khi source thực sự không đủ bất kỳ nội dung ngôn ngữ nào để suy ra bài tập.",
        "8. Cố gắng bao phủ TOÀN BỘ từ vựng và điểm ngữ pháp của bài, không chỉ lấy vài ví dụ.",
        "9. speaking phải có ít nhất các câu/prompt luyện nói lấy nguyên hoặc biến đổi tối thiểu từ câu có trong nguồn; tuyệt đối không thêm mẫu ngữ pháp ngoài bài.",
        "10. BẮT BUỘC giữ các phần khác của sách nếu có: hội thoại, phát âm, văn hóa, ghi chú, luyện tập hoặc mục đặc biệt. Dùng dialogues/pronunciation/culture/extraSections; không được bỏ vì không thuộc 6 skill chính.",
        "11. Giữ nguyên tiếng Hàn; phần giải thích/meaning viết tiếng Việt rõ ràng.",
        "12. Sinh 8-20 questions tùy lượng nội dung, phân bố nhiều dạng choice/input/reorder và ưu tiên đủ các skill có thể kiểm tra bằng quiz.",
        "Trả về DUY NHẤT một JSON object, không markdown.",
        "Hình dạng JSON tham chiếu:",
        revisionNotes.length
          ? "FEEDBACK TỪ VÒNG QA TRƯỚC - bắt buộc sửa: " + revisionNotes.join(" | ")
          : "Không có feedback vòng trước.",
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
