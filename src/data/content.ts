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
  /** Item-level evidence for the example string; never inherit the vocabulary ref. */
  exampleSourceRef?: string;
};

export type GrammarItem = {
  id: string;
  pattern: string;
  meaning: string;
  explanation: string;
  examples: string[];
  sourceRef?: string;
  /** Exact evidence for /grammar/{index}/pattern when inventoried separately. */
  patternSourceRef?: string;
  /** One source ref per example, aligned by index. */
  exampleSourceRefs?: string[];
};

export type ListeningItem = {
  id: string;
  text: string;
  meaning: string;
  choices: string[];
  answer: string;
  sourceRef?: string;
  /** One source ref per choice, aligned by index; never inherit the listening item's ref. */
  choiceSourceRefs?: string[];
};

export type ReadingContent = {
  title: string;
  text: string;
  translation: string;
  questions: {
    id: string;
    q: string;
    choices: string[];
    answer: string;
    sourceRef?: string;
    /** One source ref per choice, aligned by index; never inherit the question's ref. */
    choiceSourceRefs?: string[];
  }[];
  /** Section-level reference; never substitutes for title/text item evidence. */
  sourceRef?: string;
  /** Exact source evidence for the reading title when inventoried separately. */
  titleSourceRef?: string;
  /** Exact source evidence for the reading passage text when inventoried separately. */
  textSourceRef?: string;
};

export type WritingContent = {
  prompt: string;
  hint: string;
  targetWords: string[];
  /** Exact source evidence for the prompt when inventoried separately. */
  promptSourceRef?: string;
  sourceRef?: string;
  /** One source ref per target word, aligned by index. */
  targetWordSourceRefs?: string[];
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
  /** Only mark source after checking the actual turns against the cited pages. */
  origin?: "source" | "derived";
  translationOrigin?: "source" | "derived";
  lines: Array<{
    speaker?: string;
    targetText?: string;
    learnerMeaning?: string;
    /** Legacy runtime alias for targetText. */
    ko: string;
    /** Legacy runtime alias for learnerMeaning. */
    vi?: string;
    /** Stable item-level anchor for this dialogue line, when available. */
    sourceRef?: string;
  }>;
  sourceRef?: string;
};

export type PronunciationItem = {
  id: string;
  title: string;
  explanation: string;
  examples: string[];
  sourceRef?: string;
  /** One source ref per example, aligned by index. */
  exampleSourceRefs?: string[];
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
  /** One source ref per content entry, aligned by index. */
  contentSourceRefs?: string[];
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
  /** One source ref per speaking prompt, aligned by index. */
  speakingSourceRefs?: string[];
  reading: ReadingContent | null;
  writing: WritingContent | null;
  dialogues?: DialogueItem[];
  pronunciation?: PronunciationItem[];
  culture?: CultureItem[];
  extraSections?: ExtraSection[];
  media?: LessonMedia[];
  /** Authored, item-linked crops. Whole source pages belong in the source reader. */
  illustrations?: LearningIllustration[];
  sourceRef?: string;
  quality?: {
    coverageScore: number;
    groundingScore: number;
    issues: string[];
    missingTopics: string[];
  };
};

export type LearningIllustration = {
  id: string;
  kind: "vocabulary" | "grammar" | "dialogue" | "context";
  targetIds: string[];
  relation: "exact" | "context";
  fileName: string;
  pageNumber: number;
  /** Normalized x, y, width, height in the original page. */
  region: [number, number, number, number];
  alt: string;
  caption: string;
  sourceRef: string;
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
  /** Explicitly distinguishes textbook tasks from added practice; absent on legacy bundles. */
  origin?: "source" | "derived";
};
