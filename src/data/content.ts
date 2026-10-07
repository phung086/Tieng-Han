import type { SkillKey } from "@/lib/learning-state";

export type VocabularyItem = {
  id: string;
  /** Canonical language-neutral field. */
  targetText?: string;
  /** Canonical learner-language meaning. */
  learnerMeaning?: string;
  /** Legacy runtime alias for targetText. */
  ko: string;
  /** Legacy runtime alias for learnerMeaning. */
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

export type LessonMedia = {
  id: string;
  type: "image" | "video" | "audio" | "document";
  role: "illustration" | "diagram" | "source-page" | "external";
  src: string;
  alt: string;
  caption?: string;
  sourceRef?: string;
  fileName?: string;
  pageNumber?: number;
};

export type DialogueItem = {
  id: string;
  title?: string;
  lines: Array<{
    speaker?: string;
    targetText?: string;
    learnerMeaning?: string;
    /** Legacy runtime alias for targetText. */
    ko: string;
    /** Legacy runtime alias for learnerMeaning. */
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
  /** Canonical target-language lesson title. */
  targetTitle?: string;
  /** Canonical learner-language lesson title. */
  learnerTitle?: string;
  /** Legacy runtime alias for targetTitle. */
  title: string;
  /** Legacy runtime alias for learnerTitle. */
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
  media?: LessonMedia[];
  sourceRef?: string;
  quality?: {
    coverageScore: number;
    groundingScore: number;
    issues: string[];
    missingTopics: string[];
  };
};

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
