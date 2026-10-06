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
