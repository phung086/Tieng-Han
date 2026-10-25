import { describe, expect, it } from "vitest";
import { readMatchingSelections, updateMatchingSelection } from "@/lib/source-workbook-interactions";

describe("source workbook matching interactions", () => {
  it("persists independent pair selections by index, even when labels repeat", () => {
    let draft: string | undefined;
    draft = updateMatchingSelection(draft, 0, "1", 2, 2);
    draft = updateMatchingSelection(draft, 1, "0", 2, 2);
    expect(readMatchingSelections(draft, 2, 2)).toEqual({ "0": "1", "1": "0" });
  });

  it("clears a pair without deleting the other saved selections", () => {
    const draft = JSON.stringify({ "0": "1", "1": "0" });
    expect(readMatchingSelections(updateMatchingSelection(draft, 0, "", 2, 2), 2, 2))
      .toEqual({ "1": "0" });
  });

  it("ignores malformed JSON, non-numeric keys, and out-of-range indices", () => {
    expect(readMatchingSelections("{", 2, 2)).toEqual({});
    expect(readMatchingSelections(JSON.stringify({
      nope: "0", "0": "9", "1": "1", "2": "0", "0x": "1", "0": 1,
    }), 2, 2)).toEqual({ "1": "1" });
  });

  it("does not store out-of-range selections or invalid left indices", () => {
    expect(updateMatchingSelection(undefined, 0, "3", 2, 2)).toBe("{}");
    expect(updateMatchingSelection(undefined, 4, "1", 2, 2)).toBe("{}");
  });
});
