"use client";
import { ArrowDown, ArrowRight, Volume2 } from "lucide-react";
import type { GrammarItem } from "@/data/content";
import { grammarBlocks, meaningRepeated } from "@/lib/grammar-reader";
import styles from "./grammar-explanation.module.css";

export function GrammarExplanation({ item, onSpeak }: { item: GrammarItem; onSpeak: (text: string) => void }) {
  const blocks = grammarBlocks(item);
  const anchors = (item.pattern.match(/[가-힣]{2,}/g) ?? []).sort((a,b)=>b.length-a.length);
  const firstExample = anchors.flatMap(anchor=>blocks.filter(block=>block.kind==="example" && block.text.includes(anchor)))[0] ?? blocks.find(block => block.kind === "example");
  return <div className={styles.reader}>
    {!meaningRepeated(item) ? <p className={styles.meaning}>{item.meaning}</p> : null}
    {firstExample ? <figure className={styles.map} aria-label={"Sơ đồ câu ví dụ của mẫu " + item.pattern}><figcaption>Nhìn mẫu câu qua ví dụ</figcaption><strong className="korean-text">{item.pattern}</strong><ArrowDown aria-hidden="true" size={20} /><ol>{firstExample.text.split(/\s+/).map((part,index)=><li key={index}><button type="button" onClick={()=>onSpeak(part)}>{part}</button></li>)}</ol>{firstExample.translation ? <p>{firstExample.translation}</p> : null}</figure> : null}
    <h3>Cách dùng và ví dụ trong giáo trình</h3>
    {blocks.map((block, index) => block.kind === "prose" ? <p className={styles.prose} key={index}>{block.text}</p> :
      <figure className={styles.example} key={index}>
        <div><p className="korean-text">{block.text}</p>
          <button type="button" aria-label={"Nghe ví dụ " + block.text} onClick={() => onSpeak(block.text)}><Volume2 size={17} /></button></div>
        {block.translation ? <figcaption>{block.translation}</figcaption> : null}
        {block.text.trim().split(/\s+/).length > 1 ? <details className={styles.construction}><summary>Ghép các cụm trong câu · chạm để nghe</summary><ol aria-label="Các cụm theo thứ tự trong câu ví dụ">{block.text.trim().split(/\s+/).map((part,i)=><li key={i}><button type="button" onClick={()=>onSpeak(part)}>{part}</button>{i<block.text.trim().split(/\s+/).length-1 ? <ArrowRight aria-hidden="true" size={14} /> : null}</li>)}</ol></details> : null}
      </figure>)}
  </div>;
}
