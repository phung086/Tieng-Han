export type MatchingSelectionMap = Record<string, string>;

/** Read persisted matching selections as left-index -> right-index pairs.
 * Invalid JSON, malformed entries and out-of-range indices are ignored safely.
 */
export function readMatchingSelections(
  serialized: string | undefined,
  leftCount: number,
  rightCount: number,
): MatchingSelectionMap {
  if (!serialized || leftCount <= 0 || rightCount <= 0) return {};
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([left, right]) =>
        /^\\d+$/.test(left) &&
        Number(left) < leftCount &&
        typeof right === "string" &&
        /^\\d+$/.test(right) &&
        Number(right) < rightCount,
      ),
    ) as MatchingSelectionMap;
  } catch {
    return {};
  }
}

/** Update one pair while preserving other saved choices; an empty selection clears it. */
export function updateMatchingSelection(
  serialized: string | undefined,
  leftIndex: number,
  rightIndex: string,
  leftCount: number,
  rightCount: number,
): string {
  const selections = readMatchingSelections(serialized, leftCount, rightCount);
  if (!Number.isInteger(leftIndex) || leftIndex < 0 || leftIndex >= leftCount) {
    return JSON.stringify(selections);
  }
  if (rightIndex === "") {
    delete selections[String(leftIndex)];
  } else if (/^\\d+$/.test(rightIndex) && Number(rightIndex) < rightCount) {
    selections[String(leftIndex)] = String(Number(rightIndex));
  }
  return JSON.stringify(selections);
}
