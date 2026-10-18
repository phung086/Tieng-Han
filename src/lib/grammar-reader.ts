import type { GrammarItem } from "@/data/content";

export type GrammarBlock = { kind: "prose" | "example"; text: string; translation?: string };
const normalized = (value: string) => value.trim().replace(/\s+/g, " ");

/** Reflows source text without summarizing, dropping caveats, or generating translations. */
export function grammarBlocks(item: GrammarItem): GrammarBlock[] {
  const examples = new Set(item.examples.map(normalized));
  const lines = item.explanation.split(/\r?\n/);
  const blocks: GrammarBlock[] = [];
  const rendered = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (examples.has(normalized(line))) {
      const next = lines[i + 1]?.trim();
      // Only an immediately adjacent Vietnamese line is paired. No invented glosses.
      const translation = next && !/[가-힣]/.test(next) && /[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(next) && !/^(?:chú ý|lưu ý|cách dùng|•|\d+[.)])/i.test(next) ? next : undefined;
      blocks.push({ kind: "example", text: line, translation });
      rendered.add(normalized(line));
      if (translation) i++;
    } else {
      const previous = blocks.at(-1);
      if (previous?.kind === "prose") previous.text += "\n" + line;
      else blocks.push({ kind: "prose", text: line });
    }
  }
  for (const example of item.examples) if (!rendered.has(normalized(example))) {
    blocks.push({ kind: "example", text: example }); rendered.add(normalized(example));
  }
  return blocks;
}

export function meaningRepeated(item: GrammarItem) {
  return normalized(item.explanation).startsWith(normalized(item.meaning));
}
