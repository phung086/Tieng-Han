"use client";
import { useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import type { LessonContent, VocabularyItem } from "@/data/content";
import { illustrationsFor } from "@/lib/learning-illustrations";
import { GrammarExplanation } from "./grammar-explanation";
import { ItemIllustrations, LearningFigure } from "./learning-illustration";
import styles from "./illustrated-lesson.module.css";

function Word({ lesson, word, speak }: { lesson: LessonContent; word: VocabularyItem; speak: (text:string)=>void }) {
  const [reveal,setReveal] = useState(true);
  return <article className={styles.word}>
    <ItemIllustrations lesson={lesson} kind="vocabulary" itemId={word.id} exactOnly />
    <div className={styles.wordHeading}><h3 className="korean-text">{word.targetText || word.ko}</h3><button type="button" aria-label={"Nghe từ "+word.ko} onClick={()=>speak(word.ko)}><Volume2 aria-hidden="true" size={18} /></button></div>
    <button className={styles.meaning} type="button" aria-expanded={reveal} onClick={()=>setReveal(value=>!value)}>{reveal ? word.learnerMeaning || word.vi : "Hiện nghĩa để kiểm tra"}</button>
    {word.example ? <p className="korean-text">{word.example}</p> : null}
  </article>;
}

export function IllustratedLesson({ lesson, speak }: { lesson: LessonContent; speak: (text:string)=>void }) {
  const context = illustrationsFor(lesson,"context");
  const firstSourcePage = Number(/\bpp?\.\s*(\d+)/.exec(lesson.sourceRef ?? "")?.[1]);
  const lead = context.filter(image=>image.pageNumber===firstSourcePage);
  const further = context.filter(image=>!lead.includes(image));
  return <div className={styles.lesson}>
    <nav className={styles.contents} aria-label="Nội dung bài học có hình"><a href="#visual-vocabulary">Từ vựng</a><a href="#visual-grammar">Ngữ pháp</a>{context.length ? <a href="#visual-situations">Tình huống bằng hình</a> : null}<Link href={"/practice?lesson="+lesson.id+"#review-games"}>Chơi để nhớ</Link></nav>
    {lead.length ? <section aria-label="Hình khởi động bài học"><header className={styles.heading}><h2>Nhìn hình, thử nói về chủ đề bài học</h2></header><div className={styles.situations}>{lead.map(image=><LearningFigure key={image.id} image={image} />)}</div></section> : null}
    <section id="visual-vocabulary" aria-label="Học từ vựng cùng hình"><header className={styles.heading}><div><h2>Từ vựng · Nhìn, nghe và ghi nhớ</h2><p>Hình đi cùng mục từ có chú thích tương ứng. Chạm nghĩa để ẩn hoặc tự kiểm tra trí nhớ.</p></div><Link href={"/vocabulary?lesson="+lesson.id}>Ôn bằng flashcard</Link></header>
      <div className={styles.words}>{lesson.vocabulary.map(word=><Word key={word.id} lesson={lesson} word={word} speak={speak} />)}</div>
    </section>
    <section id="visual-grammar" aria-label="Học ngữ pháp cùng hình"><header className={styles.heading}><h2>Ngữ pháp · Hiểu rồi dùng</h2><Link href={"/grammar?lesson="+lesson.id}>Luyện từng mẫu</Link></header>
      {lesson.grammar.map(grammar=><article className={styles.grammar} key={grammar.id}><h3 className="korean-text">{grammar.pattern}</h3><ItemIllustrations lesson={lesson} kind="grammar" itemId={grammar.id} /><GrammarExplanation item={grammar} onSpeak={speak} /></article>)}
    </section>
    {further.length ? <section id="visual-situations" aria-label="Tình huống minh họa của bài"><header className={styles.heading}><div><h2>Quan sát tình huống</h2><p>Hình trong các hoạt động của bài. Thử gọi tên sự vật hoặc nói một câu bằng mẫu vừa học.</p></div></header><details><summary>Mở {further.length} hình tình huống của bài</summary><div className={styles.situations}>{further.map(image=><LearningFigure key={image.id} image={image} />)}</div></details></section> : null}
    {(lesson.dialogues ?? []).map(dialogue=><section className={styles.grammar} key={dialogue.id}><h2>{dialogue.title || "Hội thoại"}</h2><ItemIllustrations lesson={lesson} kind="dialogue" itemId={dialogue.id} />{dialogue.lines.map((line,index)=><p key={index}><button className={styles.line} type="button" onClick={()=>speak(line.ko)}><Volume2 aria-hidden="true" size={16} />{line.speaker} {line.targetText || line.ko}</button><br />{line.learnerMeaning || line.vi}</p>)}</section>)}
    <Link className="primary-button" href={"/practice/workbook?lesson="+lesson.id}>Luyện toàn bộ nội dung của bài</Link>
  </div>;
}
