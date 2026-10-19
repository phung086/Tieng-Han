"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Volume2 } from "lucide-react";
import type { GrammarItem } from "@/data/content";
import { grammarBlocks, meaningRepeated, type GrammarBlock } from "@/lib/grammar-reader";
import styles from "./grammar-explanation.module.css";

function Example({ block, onSpeak }: { block: GrammarBlock; onSpeak: (text: string) => void }) {
  return <figure className={styles.example}>
    <div><p className="korean-text">{block.text}</p><button type="button" aria-label={"Nghe ví dụ " + block.text} onClick={() => onSpeak(block.text)}><Volume2 size={18} /></button></div>
    {block.translation ? <figcaption>{block.translation}</figcaption> : null}
    {block.text.trim().split(/\s+/).length > 1 ? <details className={styles.construction}><summary>Tách câu để nghe từng cụm</summary><ol>{block.text.trim().split(/\s+/).map((part, index) => <li key={index}><button type="button" onClick={() => onSpeak(part)}>{part}</button></li>)}</ol></details> : null}
  </figure>;
}

export function GrammarExplanation({ item, onSpeak, guided = false, practiceHref }: { item: GrammarItem; onSpeak: (text: string) => void; guided?: boolean; practiceHref?: string }) {
  const [phase, setPhase] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [answer, setAnswer] = useState(false);
  const blocks = grammarBlocks(item);
  const examples = blocks.filter(block => block.kind === "example");
  const prose = blocks.filter(block => block.kind === "prose");
  const example = examples[exampleIndex];
  const phases = ["Hiểu", "Ví dụ", "Tự thử"];
  const meaning = !meaningRepeated(item) ? <p className={styles.meaning}>{item.meaning}</p> : null;
  return <div className={styles.reader}>
    {guided ? <nav className={styles.phases} aria-label={"Các bước học mẫu " + item.pattern}>{phases.map((label, index) => <button type="button" key={label} aria-pressed={phase === index} onClick={() => { setPhase(index); setAnswer(false); }}><span aria-hidden="true">{index + 1}</span>{label}</button>)}</nav> : null}
    {guided && phase === 0 ? <>{meaning}{prose.map((block, index) => <p className={styles.prose} key={index}>{block.text}</p>)}{!prose.length && !meaning ? <p className={styles.prose}>{item.meaning}</p> : null}</> : null}
    {!guided ? <>{meaning}{blocks.map((block, index) => block.kind === "prose" ? <p className={styles.prose} key={index}>{block.text}</p> : <Example key={index} block={block} onSpeak={onSpeak} />)}</> : null}
    {guided && phase === 1 ? <>{example ? <><figure className={styles.map} aria-label={"Sơ đồ câu ví dụ của mẫu " + item.pattern}><figcaption>Nghe rồi đọc theo từng cụm</figcaption><strong className="korean-text">{item.pattern}</strong><ol>{example.text.trim().split(/\s+/).map((part, index) => <li key={index}><button type="button" onClick={() => onSpeak(part)}>{part}</button></li>)}</ol></figure><Example block={example} onSpeak={onSpeak} /><nav className={styles.examplePager} aria-label="Chuyển ví dụ"><button type="button" aria-label="Ví dụ trước" disabled={exampleIndex === 0} onClick={() => setExampleIndex(value => value - 1)}><ArrowLeft size={18} /></button><span>Ví dụ {exampleIndex + 1} / {examples.length}</span><button type="button" aria-label="Ví dụ tiếp" disabled={exampleIndex + 1 >= examples.length} onClick={() => setExampleIndex(value => value + 1)}><ArrowRight size={18} /></button></nav></> : <p>Thử đặt một câu với {item.pattern}.</p>}</> : null}
    {guided && phase === 2 ? <div className={styles.recall}><h4>Thử nói hoặc nhẩm một câu</h4><p>{example?.translation || "Dùng mẫu " + item.pattern + " để nhớ lại một câu vừa học."}</p>{example ? <><button type="button" aria-expanded={answer} onClick={() => setAnswer(value => !value)}>{answer ? "Che câu mẫu" : "Xem câu mẫu"}</button>{answer ? <Example block={example} onSpeak={onSpeak} /> : null}</> : null}<p className={styles.hint}>Tự đối chiếu câu của bạn, rồi luyện thêm khi sẵn sàng.</p>{practiceHref ? <Link className="primary-button" href={practiceHref}>Luyện ngữ pháp <ArrowRight size={17} /></Link> : null}</div> : null}
    {guided && phase < 2 ? <div className={styles.next}><button type="button" onClick={() => setPhase(value => value + 1)}>{phase === 0 ? "Xem ví dụ" : "Tự thử"} <ArrowRight size={17} /></button></div> : null}
  </div>;
}
