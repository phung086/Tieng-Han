import type { SkillKey } from "@/lib/learning-state";

export type VocabularyItem = {
  id: string;
  ko: string;
  vi: string;
  example: string;
  sourceRef?: string;
};

export type GrammarItem = {
  id: string;
  pattern: string;
  meaning: string;
  explanation: string;
  examples: string[];
  sourceRef?: string;
};

export type ListeningItem = {
  id: string;
  text: string;
  meaning: string;
  choices: string[];
  answer: string;
  sourceRef?: string;
};

export type ReadingContent = {
  title: string;
  text: string;
  translation: string;
  questions: { id: string; q: string; choices: string[]; answer: string; sourceRef?: string }[];
  sourceRef?: string;
};

export type WritingContent = {
  prompt: string;
  hint: string;
  targetWords: string[];
  sourceRef?: string;
};

export type DialogueItem = {
  id: string;
  title?: string;
  lines: Array<{
    speaker?: string;
    ko: string;
    vi?: string;
  }>;
  sourceRef?: string;
};

export type PronunciationItem = {
  id: string;
  title: string;
  explanation: string;
  examples: string[];
  sourceRef?: string;
};

export type CultureItem = {
  id: string;
  title: string;
  text: string;
  sourceRef?: string;
};

export type ExtraSection = {
  id: string;
  kind: string;
  title: string;
  content: string[];
  sourceRef?: string;
};

export type LessonContent = {
  id: number;
  title: string;
  vi: string;
  objective: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  listening: ListeningItem[];
  speaking: string[];
  reading: ReadingContent | null;
  writing: WritingContent | null;
  dialogues?: DialogueItem[];
  pronunciation?: PronunciationItem[];
  culture?: CultureItem[];
  extraSections?: ExtraSection[];
  sourceRef?: string;
  quality?: {
    coverageScore: number;
    groundingScore: number;
    issues: string[];
    missingTopics: string[];
  };
};

const emptyLesson = (
  id: number,
  title: string,
  vi: string,
  objective: string,
): LessonContent => ({
  id,
  title,
  vi,
  objective,
  vocabulary: [],
  grammar: [],
  listening: [],
  speaking: [],
  reading: null,
  writing: null,
});

export const course = {
  id: "beginner-1",
  title: "Tiếng Hàn Sơ cấp 1",
  level: "초급 1",
  lessons: [
    emptyLesson(1, "안녕하세요?", "Xin chào", "Chào hỏi, giới thiệu tên và quốc tịch."),
    emptyLesson(2, "이것이 무엇입니까?", "Đây là gì?", "Gọi tên đồ vật và hỏi đây là cái gì."),
    {
      id: 3,
      title: "어디에 갑니까?",
      vi: "Bạn đi đâu?",
      objective: "Nói về địa điểm, hướng đi và hoạt động hằng ngày.",
      vocabulary: [
        { id: "v-school", ko: "학교", vi: "trường học", example: "저는 학교에 갑니다." },
        { id: "v-company", ko: "회사", vi: "công ty", example: "아버지는 회사에 갑니다." },
        { id: "v-library", ko: "도서관", vi: "thư viện", example: "도서관에서 책을 읽습니다." },
        { id: "v-bank", ko: "은행", vi: "ngân hàng", example: "은행에 갑니다." },
        { id: "v-restaurant", ko: "식당", vi: "nhà hàng", example: "식당에서 밥을 먹습니다." },
        { id: "v-home", ko: "집", vi: "nhà", example: "저는 집에 갑니다." },
      ],
      grammar: [
        {
          id: "g-e-destination",
          pattern: "N에 가다/오다",
          meaning: "đi/đến một địa điểm",
          explanation: "에 đánh dấu đích đến của động từ di chuyển như 가다, 오다.",
          examples: ["학교에 갑니다.", "친구가 집에 옵니다."],
        },
        {
          id: "g-eseo-action",
          pattern: "N에서 V",
          meaning: "thực hiện hành động tại một địa điểm",
          explanation: "에서 dùng khi địa điểm là nơi hành động diễn ra.",
          examples: ["도서관에서 공부합니다.", "식당에서 밥을 먹습니다."],
        },
      ],
      listening: [
        {
          id: "listen-1",
          text: "저는 학교에 갑니다.",
          meaning: "Tôi đi đến trường.",
          choices: ["Tôi đi đến trường.", "Tôi học ở trường.", "Tôi về nhà.", "Tôi đến công ty."],
          answer: "Tôi đi đến trường.",
        },
        {
          id: "listen-2",
          text: "도서관에서 한국어를 공부합니다.",
          meaning: "Tôi học tiếng Hàn ở thư viện.",
          choices: ["Tôi đọc sách ở nhà.", "Tôi học tiếng Hàn ở thư viện.", "Tôi đi ngân hàng.", "Tôi ăn ở nhà hàng."],
          answer: "Tôi học tiếng Hàn ở thư viện.",
        },
        {
          id: "listen-3",
          text: "친구가 은행에 갑니다.",
          meaning: "Bạn tôi đi ngân hàng.",
          choices: ["Bạn tôi đi ngân hàng.", "Bạn tôi đến trường.", "Bạn tôi đang học.", "Bạn tôi đọc sách."],
          answer: "Bạn tôi đi ngân hàng.",
        },
      ],
      speaking: [
        "저는 학교에 갑니다.",
        "저는 도서관에서 공부합니다.",
        "오늘 친구를 만납니다.",
      ],
      reading: {
        title: "민수의 하루",
        text: "민수 씨는 학생입니다. 아침에 학교에 갑니다. 오후에는 도서관에서 한국어를 공부합니다. 저녁에는 집에서 책을 읽습니다.",
        translation: "Minsu là học sinh. Buổi sáng cậu ấy đi học. Buổi chiều cậu ấy học tiếng Hàn ở thư viện. Buổi tối cậu ấy đọc sách ở nhà.",
        questions: [
          { id: "read-1", q: "민수 씨는 아침에 어디에 갑니까?", choices: ["회사", "학교", "은행"], answer: "학교" },
          { id: "read-2", q: "민수 씨는 오후에 어디에서 공부합니까?", choices: ["도서관", "집", "식당"], answer: "도서관" },
        ],
      },
      writing: {
        prompt: "Viết 3–5 câu về những nơi bạn thường đi trong ngày.",
        hint: "Thử dùng 에 với động từ di chuyển và 에서 với một hành động.",
        targetWords: ["학교", "집", "도서관", "회사", "은행", "식당"],
      },
      sourceRef: "demo:lesson-3",
    },
    emptyLesson(4, "무엇을 합니까?", "Bạn làm gì?", "Nói về hoạt động hằng ngày."),
    emptyLesson(5, "오늘은 무슨 요일입니까?", "Hôm nay là thứ mấy?", "Nói về ngày và lịch."),
    emptyLesson(6, "얼마입니까?", "Bao nhiêu tiền?", "Hỏi giá và mua sắm cơ bản."),
  ] satisfies LessonContent[],
};

export const lessonContent: Record<number, LessonContent> = Object.fromEntries(
  course.lessons.map((lesson) => [lesson.id, lesson]),
);

export function getLesson(lessonId: number) {
  return lessonContent[lessonId] ?? null;
}

export function hasSkillContent(lesson: LessonContent, skill: SkillKey) {
  switch (skill) {
    case "vocabulary":
      return lesson.vocabulary.length > 0;
    case "grammar":
      return lesson.grammar.length > 0;
    case "listening":
      return lesson.listening.length > 0;
    case "speaking":
      return lesson.speaking.length > 0;
    case "reading":
      return Boolean(lesson.reading);
    case "writing":
      return Boolean(lesson.writing);
  }
}

export type StudyQuestion = {
  id: string;
  lessonId: number;
  skill: SkillKey;
  type: "choice" | "input" | "reorder";
  title: string;
  prompt: string;
  translation?: string;
  choices?: string[];
  tokens?: string[];
  answer: string;
  explanation: string;
  sourceRef?: string;
};

export const studyQuestions: StudyQuestion[] = [
  { id: "g-3-1", lessonId: 3, skill: "grammar", type: "choice", title: "Chọn trợ từ đúng", prompt: "저는 학교__ 갑니다.", translation: "Tôi đi đến trường.", choices: ["에", "에서", "하고", "도"], answer: "에", explanation: "학교 là đích đến của 가다 nên dùng 에." },
  { id: "v-3-1", lessonId: 3, skill: "vocabulary", type: "choice", title: "Chọn nghĩa đúng", prompt: "도서관", choices: ["công ty", "thư viện", "ngân hàng", "nhà hàng"], answer: "thư viện", explanation: "도서관 nghĩa là thư viện." },
  { id: "g-3-2", lessonId: 3, skill: "grammar", type: "input", title: "Điền trợ từ", prompt: "도서관__ 한국어를 공부합니다.", translation: "Tôi học tiếng Hàn ở thư viện.", answer: "에서", explanation: "Hành động 공부하다 diễn ra tại thư viện nên dùng 에서." },
  { id: "r-3-1", lessonId: 3, skill: "reading", type: "choice", title: "Đọc hiểu nhanh", prompt: "민수 씨는 오후에 도서관에서 공부합니다. 민수 씨는 어디에서 공부합니까?", choices: ["학교", "회사", "도서관", "은행"], answer: "도서관", explanation: "Câu đầu nói rõ 민수 씨는 ... 도서관에서 공부합니다." },
  { id: "w-3-1", lessonId: 3, skill: "writing", type: "reorder", title: "Sắp xếp thành câu", prompt: "Sắp xếp các từ sau thành câu tự nhiên.", tokens: ["저는", "학교에", "갑니다"], answer: "저는 학교에 갑니다", explanation: "Trật tự cơ bản: chủ đề + địa điểm + động từ." },
  { id: "v-3-2", lessonId: 3, skill: "vocabulary", type: "input", title: "Viết từ tiếng Hàn", prompt: "Hãy viết từ “ngân hàng” bằng tiếng Hàn.", answer: "은행", explanation: "Ngân hàng = 은행." },
];

export const vocabDeck = lessonContent[3].vocabulary;
export const listeningItems = lessonContent[3].listening;
