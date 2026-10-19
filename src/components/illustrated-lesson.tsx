"use client";
import { useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import type { DialogueItem, LessonContent, VocabularyItem } from "@/data/content";
import { illustrationsFor } from "@/lib/learning-illustrations";
import { GrammarExplanation } from "./grammar-explanation";
import { ItemIllustrations, LearningFigure } from "./learning-illustration";
import styles from "./illustrated-lesson.module.css";

type RecallMode = { enabled: boolean; revision: number };
function Word({ lesson, word, speak, recall }: { lesson: LessonContent; word: VocabularyItem; speak: (text:string)=>void; recall: RecallMode }) {
  const [override,setOverride] = useState<{revision:number;show:boolean}>();
  const reveal = override?.revision===recall.revision ? override.show : !recall.enabled;
  return <article className={styles.word}>
    <ItemIllustrations lesson={lesson} kind="vocabulary" itemId={word.id} exactOnly />
    <div className={styles.wordHeading}><h3 className="korean-text">{word.targetText || word.ko}</h3><button type="button" aria-label={"Nghe từ "+word.ko} onClick={()=>speak(word.ko)}><Volume2 aria-hidden="true" size={18} /></button></div>
    <button className={styles.meaning} type="button" aria-expanded={reveal} onClick={()=>setOverride({revision:recall.revision,show:!reveal})}>{reveal ? word.learnerMeaning || word.vi : "Hiện nghĩa để kiểm tra"}</button>
    {word.example ? <p className="korean-text">{word.example}</p> : null}
  </article>;
}

function DialogueTurns({ dialogue, speak, role }: { dialogue: DialogueItem; speak: (text:string)=>void; role: string }) {
  const [revealed, setRevealed] = useState<number[]>([]);
  return <div className={styles.turns}>{dialogue.lines.map((line,index)=>{
    const hidden = Boolean(role && line.speaker===role && !revealed.includes(index));
    return <div className={styles.turn} key={index}>
      <strong>{line.speaker || "Lượt "+(index+1)}</strong>
      {hidden ? <button className={styles.recallTurn} type="button" onClick={()=>setRevealed(values=>[...values,index])}>Tự nói hoặc nhẩm câu, rồi chạm để xem</button> : <button className={styles.line} type="button" onClick={()=>speak(line.targetText || line.ko)}><Volume2 aria-hidden="true" size={16} /><span className="korean-text">{line.targetText || line.ko}</span></button>}
      {(line.learnerMeaning || line.vi) ? <p>{line.learnerMeaning || line.vi}</p> : null}
    </div>;
  })}</div>;
}

function StudyDialogue({ lesson, dialogue, speak }: { lesson: LessonContent; dialogue: DialogueItem; speak: (text:string)=>void }) {
  const [role, setRole] = useState("");
  const speakers = [...new Set(dialogue.lines.map(line=>line.speaker).filter((value): value is string=>Boolean(value)))];
  return <article className={styles.grammar}>
    <h3>{dialogue.title || "Hội thoại"}</h3>
    <ItemIllustrations lesson={lesson} kind="dialogue" itemId={dialogue.id} />
    {speakers.length>1 ? <label className={styles.role}>Nhập vai để tự nhớ câu <select value={role} onChange={event=>setRole(event.target.value)}><option value="">Đọc tất cả các lượt</option>{speakers.map(speaker=><option key={speaker} value={speaker}>Ẩn lời của {speaker}</option>)}</select></label> : null}
    <DialogueTurns key={role} dialogue={dialogue} speak={speak} role={role} />
  </article>;
}

export function IllustratedLesson({ lesson, speak, onSupplement }: { lesson: LessonContent; speak: (text:string)=>void; onSupplement: ()=>void }) {
  const [recall, setRecall] = useState<RecallMode>({enabled:false,revision:0});
  const context = illustrationsFor(lesson,"context");
  const firstSourcePage = Number(/\bpp?\.\s*(\d+)/.exec(lesson.sourceRef ?? "")?.[1]);
  const lead = context.filter(image=>image.pageNumber===firstSourcePage);
  const further = context.filter(image=>!lead.includes(image));
  return <div className={styles.lesson}>
    <nav className={styles.contents} aria-label="Nội dung bài học có hình"><a href="#visual-vocabulary">{lesson.vocabulary.length} từ vựng</a><a href="#visual-grammar">{lesson.grammar.length} mục ngữ pháp</a>{lesson.dialogues?.length ? <a href="#visual-dialogues">{lesson.dialogues.length} hội thoại</a> : null}{further.length ? <a href="#visual-situations">Tình huống bằng hình</a> : null}<a href="#visual-practice">Ôn và vận dụng</a></nav>
    {lead.length ? <section aria-label="Hình khởi động bài học"><header className={styles.heading}><h2>Nhìn hình, thử nói về chủ đề bài học</h2></header><div className={styles.situations}>{lead.map(image=><LearningFigure key={image.id} image={image} />)}</div></section> : null}
    <section id="visual-vocabulary" aria-label="Học từ vựng cùng hình"><header className={styles.heading}><div><h2>Từ vựng · Nhìn, nghe và ghi nhớ</h2><p>Chạm nghĩa để tự kiểm tra trí nhớ.</p></div><Link href={"/vocabulary?lesson="+lesson.id}>Ôn bằng flashcard</Link></header>
      <button className={styles.recallToggle} type="button" aria-pressed={recall.enabled} onClick={()=>setRecall(value=>({enabled:!value.enabled,revision:value.revision+1}))}>{recall.enabled ? "Đang tự nhớ · Hiện lại các nghĩa" : "Tự nhớ · Che nghĩa tất cả từ"}</button>
      <div className={styles.words}>{lesson.vocabulary.map(word=><Word key={word.id} lesson={lesson} word={word} speak={speak} recall={recall} />)}</div>
    </section>
    <section id="visual-grammar" aria-label="Học ngữ pháp cùng hình"><header className={styles.heading}><h2>Ngữ pháp · Hiểu rồi dùng</h2><Link href={"/grammar?lesson="+lesson.id}>Luyện từng mẫu</Link></header>
      {lesson.grammar.map(grammar=><article className={styles.grammar} key={grammar.id}><h3 className="korean-text">{grammar.pattern}</h3><ItemIllustrations lesson={lesson} kind="grammar" itemId={grammar.id} /><GrammarExplanation item={grammar} onSpeak={speak} /></article>)}
    </section>
    {further.length ? <section id="visual-situations" aria-label="Tình huống minh họa của bài"><header className={styles.heading}><div><h2>Quan sát tình huống</h2><p>Hình trong các hoạt động của bài. Thử gọi tên sự vật hoặc nói một câu bằng mẫu vừa học.</p></div></header><details><summary>Mở {further.length} hình tình huống của bài</summary><div className={styles.situations}>{further.map(image=><LearningFigure key={image.id} image={image} />)}</div></details></section> : null}
    {lesson.dialogues?.length ? <section id="visual-dialogues" aria-label="Luyện hội thoại theo vai"><header className={styles.heading}><div><h2>Hội thoại · Thử nói lời của bạn</h2><p>Đọc một lượt, chọn vai để che lời rồi tự nhớ câu. Chạm để xem lại khi cần.</p></div></header>{lesson.dialogues.map(dialogue=><StudyDialogue key={dialogue.id} lesson={lesson} dialogue={dialogue} speak={speak} />)}</section> : null}
    <section id="visual-practice" aria-label="Ôn và vận dụng"><header className={styles.heading}><h2>Ôn rồi dùng lại trong tình huống của bạn</h2></header><p>Thử nhớ lại khi chưa nhìn đáp án, rồi quay lại phần vừa quên. Những lựa chọn dưới đây luôn mở.</p><div className={styles.practiceLinks}><Link href={"/practice?lesson="+lesson.id+"#review-games"}>Chơi để nhớ từ và ghép câu</Link><Link href={"/practice/workbook?lesson="+lesson.id}>Luyện nội dung đã biên soạn</Link>{lesson.listening.length ? <Link href={"/listening?lesson="+lesson.id}>Nghe và nhận ra câu</Link> : null}{lesson.reading ? <Link href={"/reading?lesson="+lesson.id}>Đọc và kiểm tra hiểu bài</Link> : null}{lesson.writing ? <Link href={"/writing?lesson="+lesson.id}>Viết và vận dụng từ</Link> : null}{lesson.pronunciation?.length ? <Link href={"/pronunciation?lesson="+lesson.id}>Luyện phát âm</Link> : null}</div><button className={styles.recallToggle} type="button" onClick={onSupplement}>Mở phát âm, văn hóa và hoạt động gốc đã lưu</button></section>
  </div>;
}
