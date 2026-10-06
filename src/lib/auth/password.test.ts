import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";

describe("Haneul password authentication", () => {
  it("hashes passwords with a random salt and verifies the original", async () => {
    const first = await hashPassword("learning-korean-123");
    const second = await hashPassword("learning-korean-123");

    expect(first).not.toBe(second);
    expect(await verifyPassword("learning-korean-123", first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
  });

  it("normalizes emails for unique account identity", () => {
    expect(normalizeEmail("  Learner@Example.COM ")).toBe(
      "learner@example.com",
    );
  });
});
