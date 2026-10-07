import { describe, expect, it } from "vitest";
import { canDeleteImportJob } from "@/lib/import-jobs";

describe("import job retention policy", () => {
  it("allows cleanup only after failure or successful consumption", () => {
    expect(canDeleteImportJob("failed")).toBe(true);
    expect(canDeleteImportJob("consumed")).toBe(true);

    for (const status of [
      "uploading",
      "queued",
      "processing",
      "ready",
    ] as const) {
      expect(canDeleteImportJob(status)).toBe(false);
    }
  });
});
