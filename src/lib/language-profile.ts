export type TargetLanguageCode = "ko" | "en" | "zh";
export type LearnerLanguageCode = "vi" | "en";

export type LanguageProfile = {
  target: TargetLanguageCode;
  learner: LearnerLanguageCode;
  targetName: string;
  learnerName: string;
  locale: string;
  script: "hangul" | "latin" | "han";
};

export const languageProfiles: Record<TargetLanguageCode, LanguageProfile> = {
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

export const defaultLanguageProfile = languageProfiles.ko;

export function getLanguageProfile(
  target: TargetLanguageCode,
  learner: LearnerLanguageCode = "vi",
): LanguageProfile {
  const base = languageProfiles[target];
  return {
    ...base,
    learner,
    learnerName: learner === "vi" ? "Tiếng Việt" : "English",
  };
}
