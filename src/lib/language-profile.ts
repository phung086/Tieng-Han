export type TargetLanguageCode = string;
export type LearnerLanguageCode = string;

export type WritingSystem =
  | "hangul"
  | "latin"
  | "han"
  | "kana"
  | "arabic"
  | "cyrillic"
  | "devanagari"
  | "other";

export type LanguageProfile = {
  target: TargetLanguageCode;
  learner: LearnerLanguageCode;
  targetName: string;
  learnerName: string;
  locale: string;
  script: WritingSystem;
};

export const languageProfiles: Record<string, LanguageProfile> = {
  ko: {
    target: "ko",
    learner: "vi",
    targetName: "Tiếng Hàn",
    learnerName: "Tiếng Việt",
    locale: "ko-KR",
    script: "hangul",
  },
  en: {
    target: "en",
    learner: "vi",
    targetName: "Tiếng Anh",
    learnerName: "Tiếng Việt",
    locale: "en-US",
    script: "latin",
  },
  zh: {
    target: "zh",
    learner: "vi",
    targetName: "Tiếng Trung",
    learnerName: "Tiếng Việt",
    locale: "zh-CN",
    script: "han",
  },
};

const learnerNames: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

export const defaultLanguageProfile = languageProfiles.ko;

export function createLanguageProfile(input: {
  target: string;
  learner?: string;
  targetName?: string;
  learnerName?: string;
  locale?: string;
  script?: WritingSystem;
}): LanguageProfile {
  const target = input.target.trim();
  const learner = (input.learner ?? "vi").trim();

  if (!target) {
    throw new Error("Target language code không được để trống.");
  }

  return {
    target,
    learner,
    targetName: input.targetName?.trim() || target,
    learnerName:
      input.learnerName?.trim() || learnerNames[learner] || learner,
    locale: input.locale?.trim() || target,
    script: input.script ?? "other",
  };
}

export function getLanguageProfile(
  target: TargetLanguageCode,
  learner: LearnerLanguageCode = "vi",
  overrides?: Partial<Omit<LanguageProfile, "target" | "learner">>,
): LanguageProfile {
  const base = languageProfiles[target];

  return createLanguageProfile({
    target,
    learner,
    targetName: overrides?.targetName ?? base?.targetName,
    learnerName:
      overrides?.learnerName ??
      (learner === base?.learner ? base?.learnerName : undefined),
    locale: overrides?.locale ?? base?.locale,
    script: overrides?.script ?? base?.script,
  });
}
