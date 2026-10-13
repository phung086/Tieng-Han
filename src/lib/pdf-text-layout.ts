/**
 * PDF.js TextContent items carry hasEOL markers. Preserve those boundaries so
 * numbered exercise subparts, dialogue turns and sentence examples do not get
 * flattened into one long paragraph during automatic textbook ingestion.
 */
export function composePdfPageText(
  items: Array<{ str?: string; hasEOL?: boolean }>,
): string {
  let output = "";
  for (const item of items) {
    if (typeof item.str === "string" && item.str) {
      output += item.str;
    }
    output += item.hasEOL ? "\n" : " ";
  }
  return output
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
