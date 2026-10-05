import type { SkillKey } from "@/lib/learning-state";

export const lessonContent = {
  1: { title: "안녕하세요?", vi: "Xin chào", objective: "Chào hỏi, giới thiệu tên và quốc tịch." },
  2: { title: "이것이 무엇입니까?", vi: "Đây là gì?", objective: "Gọi tên đồ vật và hỏi đây là cái gì." },
  3: {
    title: "어디에 갑니까?",
    vi: "Bạn đi đâu?",
    objective: "Nói về địa điểm, hướng đi và hoạt động hằng ngày.",
    vocabulary: [
      { ko: "학교", vi: "trường học", example: "저는 학교에 갑니다." },
      { ko: "회사", vi: "công ty", example: "아버지는 회사에 갑니다." },
      { ko: "도서관", vi: "thư viện", example: "도서관에서 책을 읽습니다." },
      { ko: "은행", vi: "ngân hàng", example: "은행에 갑니다." },
      { ko: "식당", vi: "nhà hàng", example: "식당에서 밥을 먹습니다." },
      { ko: "집", vi: "nhà", example: "저는 집에 갑니다." },
    ],
    grammar: [
      {
        pattern: "N에 가다/오다",
        meaning: "đi/đến một địa điểm",
        explanation: "에 đánh dấu đích đến của động từ di chuyển như 가다, 오다.",
        examples: ["학교에 갑니다.", "친구가 집에 옵니다."],
      },
      {
        pattern: "N에서 V",
        meaning: "thực hiện hành động tại một địa điểm",
        explanation: "에서 dùng khi địa điểm là nơi hành động diễn ra.",
        examples: ["도서관에서 공부합니다.", "식당에서 밥을 먹습니다."],
      },
    ],
    listening: [
      { text: "저는 학교에 갑니다.", meaning: "Tôi đi đến trường." },
      { text: "민수 씨는 도서관에서 공부합니다.", meaning: "Minsu học ở thư viện." },
      { text: "친구가 은행에 갑니다.", meaning: "Bạn tôi đi ngân hàng." },
    ],
    speaking: ["저는 학교에 갑니다.", "저는 도서관에서 공부합니다.", "오늘 친구를 만납니다."],
    reading: {
      title: "민수의 하루",
      text: "민수 씨는 학생입니다. 아침에 학교에 갑니다. 오후에는 도서관에서 한국어를 공부합니다. 저녁에는 집에서 책을 읽습니다.",
      translation: "Minsu là học sinh. Buổi sáng cậu ấy đi học. Buổi chiều cậu ấy học tiếng Hàn ở thư viện. Buổi tối cậu ấy đọc sách ở nhà.",
    },
  },
} as const;

export type StudyQuestion = {
  id: string;
  skill: SkillKey;
  type: "choice" | "input" | "reorder";
  title: string;
  prompt: string;
  translation?: string;
  choices?: string[];
  tokens?: string[];
  answer: string;
  explanation: string;
};

export const studyQuestions: StudyQuestion[] = [
  { id: "g-3-1", skill: "grammar", type: "choice", title: "Chọn trợ từ đúng", prompt: "저는 학교__ 갑니다.", translation: "Tôi đi đến trường.", choices: ["에", "에서", "하고", "도"], answer: "에", explanation: "학교 là đích đến của 가다 nên dùng 에." },
  { id: "v-3-1", skill: "vocabulary", type: "choice", title: "Chọn nghĩa đúng", prompt: "도서관", choices: ["công ty", "thư viện", "ngân hàng", "nhà hàng"], answer: "thư viện", explanation: "도서관 nghĩa là thư viện." },
  { id: "g-3-2", skill: "grammar", type: "input", title: "Điền trợ từ", prompt: "도서관__ 한국어를 공부합니다.", translation: "Tôi học tiếng Hàn ở thư viện.", answer: "에서", explanation: "Hành động 공부하다 diễn ra tại thư viện nên dùng 에서." },
  { id: "r-3-1", skill: "reading", type: "choice", title: "Đọc hiểu nhanh", prompt: "민수 씨는 오후에 도서관에서 공부합니다. 민수 씨는 어디에서 공부합니까?", choices: ["학교", "회사", "도서관", "은행"], answer: "도서관", explanation: "Câu đầu nói rõ 민수 씨는 ... 도서관에서 공부합니다." },
  { id: "w-3-1", skill: "writing", type: "reorder", title: "Sắp xếp thành câu", prompt: "Sắp xếp các từ sau thành câu tự nhiên.", tokens: ["저는", "학교에", "갑니다"], answer: "저는 학교에 갑니다", explanation: "Trật tự cơ bản: chủ đề + địa điểm + động từ." },
  { id: "v-3-2", skill: "vocabulary", type: "input", title: "Viết từ tiếng Hàn", prompt: "Hãy viết từ “ngân hàng” bằng tiếng Hàn.", answer: "은행", explanation: "Ngân hàng = 은행." },
];

export const vocabDeck = [
  { id: "v-school", ko: "학교", vi: "trường học", example: "저는 학교에 갑니다." },
  { id: "v-company", ko: "회사", vi: "công ty", example: "아버지는 회사에 갑니다." },
  { id: "v-library", ko: "도서관", vi: "thư viện", example: "도서관에서 공부합니다." },
  { id: "v-bank", ko: "은행", vi: "ngân hàng", example: "은행에 갑니다." },
  { id: "v-restaurant", ko: "식당", vi: "nhà hàng", example: "식당에서 밥을 먹습니다." },
  { id: "v-home", ko: "집", vi: "nhà", example: "저녁에 집에 갑니다." },
];

export const listeningItems = [
  { id: "listen-1", text: "저는 학교에 갑니다.", choices: ["Tôi đi đến trường.", "Tôi học ở trường.", "Tôi về nhà.", "Tôi đến công ty."], answer: "Tôi đi đến trường." },
  { id: "listen-2", text: "도서관에서 한국어를 공부합니다.", choices: ["Tôi đọc sách ở nhà.", "Tôi học tiếng Hàn ở thư viện.", "Tôi đi ngân hàng.", "Tôi ăn ở nhà hàng."], answer: "Tôi học tiếng Hàn ở thư viện." },
  { id: "listen-3", text: "친구가 은행에 갑니다.", choices: ["Bạn tôi đi ngân hàng.", "Bạn tôi đến trường.", "Bạn tôi đang học.", "Bạn tôi đọc sách."], answer: "Bạn tôi đi ngân hàng." },
];
