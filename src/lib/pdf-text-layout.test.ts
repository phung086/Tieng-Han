import { describe, expect, it } from "vitest";
import { composePdfPageText } from "@/lib/pdf-text-layout";

describe("source PDF layout preservation", () => {
  it("keeps item numbers and answer choices on separate lines", () => {
    const items = [
      { str: "1. 다음 문장을 완성하세요.", hasEOL: true },
      { str: "(1) 저는 학생", hasEOL: false },
      { str: "입니다.", hasEOL: true },
      { str: "(2) 학교에 갑니다.", hasEOL: true },
      { str: "① 학교", hasEOL: true },
      { str: "② 회사", hasEOL: true },
    ];
    const text = composePdfPageText(items);
    expect(text).toContain("1. 다음 문장을 완성하세요.\n");
    expect(text).toContain("(1) 저는 학생 입니다.\n");
    expect(text).toContain("(2) 학교에 갑니다.\n① 학교\n② 회사");
    expect(text.split("\n")).toHaveLength(5);
  });

  it("preserves speaker turns, rather than flattening a dialogue", () => {
    const text = composePdfPageText([
      { str: "민수: 안녕하세요?", hasEOL: true },
      { str: "영희: 안녕하세요!", hasEOL: true },
      { str: "연습 문제:", hasEOL: true },
      { str: "저는 학생입니다.", hasEOL: false },
    ]);
    expect(text).toBe("민수: 안녕하세요?\n영희: 안녕하세요!\n연습 문제:\n저는 학생입니다.");
  });

  it("normalizes spaces without destroying visual line boundaries", () => {
    expect(composePdfPageText([
      { str: " 첫  ", hasEOL: true },
      { str: " 둘 ", hasEOL: true },
      { str: " 끝 ", hasEOL: false },
    ])).toBe("첫\n둘\n끝");
  });
});
