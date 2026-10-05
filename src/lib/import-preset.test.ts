import { describe, expect, it } from "vitest";
import { defaultImportHint, fileStem } from "@/lib/import-preset";
import { getLanguageProfile } from "@/lib/language-profile";

describe("import-preset", () => {
  it("builds a clean title from the uploaded filename", () => {
    expect(fileStem("SACH_SO_CAP_1.pdf")).toBe("SACH SO CAP 1");
    expect(fileStem("Korean-Beginner-1.PDF")).toBe("Korean Beginner 1");
  });

  it("uses the target language as a safe fallback level", () => {
    const hint = defaultImportHint(
      "Korean Beginner 1.pdf",
      getLanguageProfile("ko"),
    );

    expect(hint.title).toBe("Korean Beginner 1");
    expect(hint.level).toBe("Tiếng Hàn");
  });
});
