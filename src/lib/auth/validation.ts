import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự.")
    .max(80, "Tên quá dài."),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ.")
    .max(160, "Email quá dài."),
  password: z
    .string()
    .min(10, "Mật khẩu phải có ít nhất 10 ký tự.")
    .max(128, "Mật khẩu quá dài."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ.").max(160),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128),
});

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}


export const avatarKeySchema = z.enum([
  "cloud",
  "star",
  "moon",
  "book",
  "sparkles",
  "leaf",
]);

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự.")
    .max(80, "Tên quá dài."),
  avatarKey: avatarKeySchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu hiện tại.")
    .max(128),
  newPassword: z
    .string()
    .min(10, "Mật khẩu mới phải có ít nhất 10 ký tự.")
    .max(128, "Mật khẩu mới quá dài."),
  revokeOtherSessions: z.boolean().default(true),
});

export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("revoke"),
    sessionId: z.string().uuid("Session ID không hợp lệ."),
  }),
  z.object({
    action: z.literal("revokeOthers"),
  }),
]);
