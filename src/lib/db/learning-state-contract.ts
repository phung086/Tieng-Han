import { z } from "zod";

const skillStatSchema = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
});

const dailyStatSchema = z.object({
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  xp: z.number().int().min(0),
});

const masteryItemSchema = z.object({
  strength: z.number().min(0).max(100),
  lastReviewed: z.string().max(32),
  dueAt: z.string().max(32),
});

export const learningStateSchema = z.object({
  version: z.literal(2),
  xp: z.number().int().min(0).max(100_000_000),
  streak: z.number().int().min(0).max(100_000),
  dailyGoal: z.number().int().min(0).max(100_000),
  todayXp: z.number().int().min(0).max(1_000_000),
  lastActiveDate: z.string().max(32).nullable(),
  lessonProgress: z.record(
    z.string().max(64),
    z.number().min(0).max(100),
  ),
  skills: z.object({
    vocabulary: skillStatSchema,
    grammar: skillStatSchema,
    listening: skillStatSchema,
    speaking: skillStatSchema,
    reading: skillStatSchema,
    writing: skillStatSchema,
  }),
  completedActivities: z.array(z.string().max(250)).max(50_000),
  dailyStats: z.record(z.string().max(32), dailyStatSchema),
  mastery: z.record(z.string().max(250), masteryItemSchema),
});

export const saveLearningStateSchema = z.object({
  courseId: z.string().min(1).max(250),
  state: learningStateSchema,
});
