import { describe, expect, it } from "vitest";
import {
  buildSourceReaderHref,
  parseSourceReaderLocation,
} from "@/lib/source-reader-navigation";

describe("source reader URL navigation", () => {
  it("updates page and document while preserving unrelated query and hash", () => {
    expect(
      buildSourceReaderHref(
        "https://haneul.test/sources?tab=original&page=2#page-view",
        7,
        "book-2",
      ),
    ).toBe("/sources?tab=original&page=7#page-view".replace("#page-view", "&document=book-2#page-view"));
  });

  it("removes a selected document when returning to the default source", () => {
    expect(
      buildSourceReaderHref(
        "https://haneul.test/sources?document=book-2&page=4&tab=original",
        1,
        "",
      ),
    ).toBe("/sources?page=1&tab=original");
  });

  it("parses a valid page and document from browser history URLs", () => {
    expect(
      parseSourceReaderLocation(
        "https://haneul.test/sources?page=12&document=book-3",
      ),
    ).toEqual({ page: 12, documentId: "book-3" });
  });

  it.each(["0", "-1", "not-a-page", "1.5"])(
    "falls back to page 1 for invalid page value %s",
    (page) => {
      expect(
        parseSourceReaderLocation(
          "https://haneul.test/sources?page=" + encodeURIComponent(page),
        ).page,
      ).toBe(1);
    },
  );
});
