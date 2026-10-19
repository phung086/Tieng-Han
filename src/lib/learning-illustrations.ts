import { z } from "zod";
import type { LearningIllustration, LessonContent } from "@/data/content";

export const illustrationSchema = z.object({
  id: z.string().trim().min(1), kind: z.enum(["vocabulary", "grammar", "dialogue", "context"]),
  targetIds: z.array(z.string().trim().min(1)), relation: z.enum(["exact", "context"]),
  fileName: z.string().trim().min(1), pageNumber: z.number().int().positive(),
  region: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().positive().max(1), z.number().positive().max(1)])
    .refine(([x,y,w,h]) => x < 1 && y < 1 && x+w <= 1.000001 && y+h <= 1.000001 && w*h < .8, "Crop must stay inside the page and cannot be a whole page"),
  alt: z.string().trim().min(1), caption: z.string(), sourceRef: z.string().trim().min(1),
}).superRefine((item,ctx) => {
  if (item.kind !== "context" && !item.targetIds.length) ctx.addIssue({code:"custom",path:["targetIds"],message:"An item illustration needs explicit target IDs"});
  if (item.relation === "exact" && (item.kind !== "vocabulary" || item.targetIds.length !== 1)) ctx.addIssue({code:"custom",path:["relation"],message:"Exact image cues require one vocabulary target"});
});

export function illustrationsFor(lesson: LessonContent, kind: LearningIllustration["kind"], itemId?: string, exactOnly = false) {
  return (lesson.illustrations ?? []).filter(item => item.kind === kind && (!itemId || item.targetIds.includes(itemId)) && (!exactOnly || item.relation === "exact"));
}

export function illustrationUrl(courseId: string, illustration: LearningIllustration) {
  return "/api/courses/" + encodeURIComponent(courseId) + "/illustrations?" + new URLSearchParams({ id: illustration.id });
}

export function cropPixels(region: LearningIllustration["region"], width: number, height: number) {
  const left = Math.floor(region[0] * width), top = Math.floor(region[1] * height);
  return { left, top, width: Math.max(1, Math.min(width-left, Math.ceil(region[2]*width))), height: Math.max(1, Math.min(height-top, Math.ceil(region[3]*height))) };
}
