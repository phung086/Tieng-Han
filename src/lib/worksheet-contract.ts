import { z } from "zod";

export const MAX_WORKSHEET_PAGES = 6;
export const MAX_WORKSHEET_ITEMS = 80;
export const worksheetQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  page: z.number().int().min(1).max(MAX_WORKSHEET_PAGES),
  question: z.string().trim().min(1).max(1600),
  instruction: z.string().max(800).default(""),
  warning: z.string().max(500).default(""),
});
export const worksheetItemSchema = worksheetQuestionSchema.extend({
  answer: z.string().max(2400).default(""),
  translation: z.string().max(2400).default(""),
});
export type WorksheetItem = z.infer<typeof worksheetItemSchema>;
export const worksheetDraftSchema = z.object({
  version: z.literal(1),
  items: z.array(worksheetItemSchema).min(1).max(MAX_WORKSHEET_ITEMS),
}).refine((draft) => new Set(draft.items.map((item) => item.id)).size === draft.items.length, "ID câu hỏi bị trùng");

const imageSchema = z.string().max(2_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/);
export const worksheetRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("extract"),
    pages: z.array(z.object({
      page: z.number().int().min(1).max(MAX_WORKSHEET_PAGES),
      image: imageSchema.optional(),
      text: z.string().max(20_000).default(""),
    }).refine((page) => Boolean(page.image || page.text.trim()), "Trang trống"))
      .min(1).max(MAX_WORKSHEET_PAGES)
      .refine((pages) => new Set(pages.map((page) => page.page)).size === pages.length, "Số trang bị trùng"),
  }),
  z.object({
    action: z.literal("solve"),
    questions: z.array(worksheetQuestionSchema).min(1).max(MAX_WORKSHEET_ITEMS)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "ID trùng"),
  }),
]);

/** Manual paste keeps text intact; only explicitly recognizable worksheet decoration is omitted. */
export function questionsFromText(text: string): WorksheetItem[] {
  const lines = text.normalize("NFC").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let instruction = "";
  const items: WorksheetItem[] = [];
  for (const line of lines) {
    if (/^(?:bài\s+\d+\s*[:.\-–]?\s*(?:giới thiệu|소개)|giới thiệu\s*\(소개\)|[._…]{4,})$/iu.test(line)) continue;
    if (/^(?:\d+[.)]\s*)?(?:dịch câu (?:việt hàn|hàn việt)|hãy (?:chọn|hoàn thành|đọc)|xem tranh và)/iu.test(line)) {
      instruction = line;
      continue;
    }
    items.push({ id: `q${items.length + 1}`, page: 1, question: line.replace(/^\(?\d+[.)]\s*/, ""), instruction, warning: "", answer: "", translation: "" });
  }
  return items;
}

export const SAMPLE_WORKSHEET: WorksheetItem[] = [
  ["Hoa là người Việt Nam.", "호아 씨는 베트남 사람입니다."],
  ["Giáo viên của tôi / cô giáo tôi / thầy giáo tôi là người Trung Quốc.", "제 선생님은 중국 사람입니다."],
  ["Bạn của tôi là bác sĩ.", "제 친구는 의사입니다."],
  ["Tên của giáo viên tôi là cô Leo Na.", "제 선생님의 이름은 레오나입니다."],
  ["Mẹ của bạn là nội trợ đúng không?", "어머니는 주부이십니까?"],
  ["남 씨는 영어 선생님입니다.", "Nam là giáo viên tiếng Anh."],
].map(([question, answer], index) => ({ id: `sample${index}`, page: 1, question, answer, translation: "", instruction: "Dịch câu Việt–Hàn hoặc Hàn–Việt", warning: index === 3 ? "Phiên âm Leo Na thành 레오나; kiểm tra cách viết tên theo đề gốc." : index === 4 ? "Đã dùng cách nói kính ngữ với mẹ; chủ thể được hiểu theo ngữ cảnh." : "" }));
