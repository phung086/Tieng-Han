import type { WorksheetItem } from "@/lib/worksheet-contract";

export type NotebookStyle = { size: number; ink: "blue" | "black"; texture: boolean; seed: number };
export type NotebookLine = { text: string; row: number; item: number; role: "question" | "answer" };
export const PAGE_WIDTH = 1654;
export const PAGE_HEIGHT = 2339;
export const LEFT = 148;
export const RIGHT = 105;
export const TOP = 154;
export const RULE_GAP = 64;
export const ROWS = 32;

export function wrapNotebookText(text: string, maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.normalize("NFC").split(/\r?\n/)) {
    let line = "";
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (measure(word) > maxWidth) {
        if (line) { lines.push(line); line = ""; }
        for (const char of Array.from(word)) {
          if (line && measure(line + char) > maxWidth) { lines.push(line); line = ""; }
          line += char;
        }
      } else if (line && measure(line + " " + word) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line += (line ? " " : "") + word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Page layout is shared by preview and export; reserve slack for pen jitter and numbers. */
export function layoutNotebook(items: WorksheetItem[], measure: (text: string) => number): NotebookLine[][] {
  const pages: NotebookLine[][] = [[]];
  let row = 0;
  const nextPage = () => { pages.push([]); row = 0; };
  items.forEach((item, index) => {
    const question = wrapNotebookText(`${index + 1}. ${item.question}`, PAGE_WIDTH - LEFT - RIGHT - 24, measure);
    const answer = [item.answer, item.translation].filter(Boolean).flatMap((text) => wrapNotebookText(text, PAGE_WIDTH - LEFT - RIGHT - 56, measure));
    const count = question.length + answer.length;
    if (row > 0 && count <= ROWS && row + count > ROWS) nextPage();
    for (const [role, lines] of [["question", question], ["answer", answer]] as const) {
      for (const text of lines) {
        if (row >= ROWS) nextPage();
        pages[pages.length - 1].push({ text, row: row++, item: index, role });
      }
    }
    row++; // One blank ruled line between question/answer pairs.
  });
  return pages.filter((page) => page.length);
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
