import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  sessionActionSchema,
  updateProfileSchema,
} from "@/lib/auth/validation";

describe("account validation", () => {
  it("accepts a trimmed learner display name and avatar preset", () => {
    const parsed = updateProfileSchema.parse({
      name: "  Hương  ",
      avatarKey: "moon",
    });
    expect(parsed.name).toBe("Hương");
    expect(parsed.avatarKey).toBe("moon");
  });

  it("rejects unsupported avatar values", () => {
    const parsed = updateProfileSchema.safeParse({
      name: "Hương",
      avatarKey: "custom-file",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects short replacement passwords", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "short",
      revokeOtherSessions: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("defaults password changes to revoking other sessions", () => {
    const parsed = changePasswordSchema.parse({
      currentPassword: "current-password",
      newPassword: "new-password-123",
    });

    expect(parsed.revokeOtherSessions).toBe(true);
  });

  it("accepts only supported session actions", () => {
    expect(
      sessionActionSchema.safeParse({ action: "revokeOthers" }).success,
    ).toBe(true);
    expect(
      sessionActionSchema.safeParse({
        action: "revoke",
        sessionId: "9f9cde4b-fac1-4e72-9920-3f9066251cb5",
      }).success,
    ).toBe(true);
    expect(
      sessionActionSchema.safeParse({ action: "deleteEverything" }).success,
    ).toBe(false);
  });
});
