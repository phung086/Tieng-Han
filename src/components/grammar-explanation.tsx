"use client";
import { Volume2 } from "lucide-react";
import type { GrammarItem } from "@/data/content";
import { grammarBlocks, meaningRepeated } from "@/lib/grammar-reader";
import styles from "./grammar-explanation.module.css";

export function GrammarExplanation({ item, onSpeak }: { item: GrammarItem; onSpeak: (text: string) => void }) {
  return <div className={styles.reader}>
    {!meaningRepeated(item) ? <p className={styles.meaning}>{item.meaning}</p> : null}
    <h3>Cách dùng và ví dụ trong giáo trình</h3>
    {grammarBlocks(item).map((block, index) => block.kind === "prose" ? <p className={styles.prose} key={index}>{block.text}</p> :
      <figure className={styles.example} key={index}>
        <div><p className="korean-text">{block.text}</p>
          <button type="button" aria-label={"Nghe ví dụ " + block.text} onClick={() => onSpeak(block.text)}><Volume2 size={17} /></button></div>
        {block.translation ? <figcaption>{block.translation}</figcaption> : null}
      </figure>)}
  </div>;
}
