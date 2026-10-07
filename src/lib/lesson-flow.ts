import type { SkillKey } from "@/lib/learning-state";

export type LessonFlowStep = {
  skill: SkillKey | "mastery" | "lesson";
  label: string;
  href: string;
};

const order: SkillKey[] = [
  "vocabulary",
  "grammar",
  "listening",
  "speaking",
  "reading",
  "writing",
];

const hrefBySkill: Record<SkillKey, (lessonId: number) => string> = {
  vocabulary: (lessonId) => "/vocabulary?lesson=" + lessonId,
  grammar: (lessonId) => "/grammar?lesson=" + lessonId,
  listening: (lessonId) => "/listening?lesson=" + lessonId,
  speaking: (lessonId) => "/speaking?lesson=" + lessonId,
  reading: (lessonId) => "/reading?lesson=" + lessonId,
  writing: (lessonId) => "/writing?lesson=" + lessonId,
};

const labels: Record<SkillKey, string> = {
  vocabulary: "Ngữ pháp",
  grammar: "Xong phần cốt lõi",
  listening: "Nói (tùy chọn)",
  speaking: "Đọc (tùy chọn)",
  reading: "Viết (tùy chọn)",
  writing: "Mastery Check",
};

export function getNextLessonFlowStep(
  lessonId: number,
  currentSkill: SkillKey,
): LessonFlowStep {
  if (currentSkill === "grammar") {
    return {
      skill: "lesson",
      label: labels[currentSkill],
      href: "/learn/" + lessonId,
    };
  }

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

  return {
    skill: nextSkill,
    label: labels[currentSkill],
    href: hrefBySkill[nextSkill](lessonId),
  };
}
