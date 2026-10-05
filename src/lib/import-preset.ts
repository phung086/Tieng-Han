import type { LanguageProfile } from "@/lib/language-profile";

export function fileStem(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function defaultImportHint(
  fileName: string,
  language: LanguageProfile,
) {
  return {
    title: fileStem(fileName) || language.targetName,
    level: language.targetName,
  };
}
