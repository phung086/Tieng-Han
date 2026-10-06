import type { SkillKey } from "@/lib/learning-state";

export type LessonFlowStep = {
  skill: SkillKey | "mastery";
  label: string;
  href: string;
};

const labels: Record<SkillKey, string> = {
  vocabulary: "Ngữ pháp",
  grammar: "Nghe",
  listening: "Nói",
  speaking: "Đọc",
  reading: "Viết",
  writing: "Mastery Check",
};

const order: SkillKey[] = [
  "vocabulary",
  "grammar",
  "listening",
  "speaking",
  "reading",
  "writing",
];

export function getNextLessonFlowStep(
  lessonId: number,
  currentSkill: SkillKey,
): LessonFlowStep {
  const index = order.indexOf(currentSkill);
  const nextSkill = order[index + 1];

  if (!nextSkill) {
    return {
      skill: "mastery",
      label: labels[currentSkill],
      href:
        "/practice/quiz?lesson=" +
        lessonId +
        "&mode=mastery",
    };
  }

  const hrefBySkill: Record<SkillKey, string> = {
    vocabulary: "/vocabulary?lesson=" + lessonId,
    grammar: "/grammar?lesson=" + lessonId,
    listening: "/listening?lesson=" + lessonId,
    speaking: "/speaking?lesson=" + lessonId,
    reading: "/reading?lesson=" + lessonId,
    writing: "/writing?lesson=" + lessonId,
  };

  return {
    skill: nextSkill,
    label: labels[currentSkill],
    href: hrefBySkill[nextSkill],
  };
}
