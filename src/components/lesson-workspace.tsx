"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Headphones, Mic2, PenLine, Play, Volume2 } from "lucide-react";
import { getLesson } from "@/data/content";
import { useLearning } from "@/lib/learning-state";

const tabs = ["Tổng quan", "Từ vựng", "Ngữ pháp", "Đọc"] as const;

export function LessonWorkspace({ lessonId }: { lessonId: number }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tổng quan");
  const { state } = useLearning();
  const lesson = getLesson(lessonId);
  const progress = state.lessonProgress[String(lessonId)] ?? 0;

  if (!lesson) {
    return (
      <div className="empty-lesson">
        <span className="eyebrow">KHÔNG TÌM THẤY BÀI HỌC</span>
        <h1>Bài {lessonId}</h1>
        <p>Bài học này chưa tồn tại trong dữ liệu giáo trình hiện tại.</p>
        <Link className="primary-button" href="/learn">Quay lại giáo trình</Link>
      </div>
    );
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="lesson-workspace">
      <header className="lesson-workspace-header">
        <div>
          <span className="kicker">SƠ CẤP 1 · BÀI {lessonId}</span>
          <h1 className="korean-text">{lesson.title}</h1>
          <p>{lesson.vi} · {lesson.objective}</p>
        </div>
        <div className="lesson-header-actions">
          <span className="lesson-progress-pill">{progress}% hoàn thành</span>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId}><Play size={17} /> Luyện bài này</Link>
        </div>
      </header>

      <nav className="lesson-tabs" aria-label="Nội dung bài học">
        {tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </nav>

      {tab === "Tổng quan" ? (
        <section className="lesson-overview-grid">
          <article className="lesson-main-card">
            <span className="eyebrow">MỤC TIÊU BÀI HỌC</span>
            <h2>{lesson.objective}</h2>
            <p>Mỗi kỹ năng được hoàn thành độc lập; tiến độ của bài được tính từ 6 phần Từ vựng, Ngữ pháp, Nghe, Nói, Đọc và Viết.</p>
            <div className="lesson-step-list">
              <button onClick={() => setTab("Từ vựng")}><span>01</span><div><strong>어휘 · Từ vựng</strong><small>{lesson.vocabulary.length} mục</small></div></button>
              <button onClick={() => setTab("Ngữ pháp")}><span>02</span><div><strong>문법 · Ngữ pháp</strong><small>{lesson.grammar.length} điểm</small></div></button>
              <Link href={"/listening?lesson=" + lessonId}><span>03</span><div><strong>듣기 · Nghe</strong><small>{lesson.listening.length} bài</small></div></Link>
              <Link href={"/speaking?lesson=" + lessonId}><span>04</span><div><strong>말하기 · Nói</strong><small>{lesson.speaking.length} câu luyện</small></div></Link>
              <button onClick={() => setTab("Đọc")}><span>05</span><div><strong>읽기 · Đọc</strong><small>{lesson.reading ? "1 bài đọc" : "Chưa nhập"}</small></div></button>
              <Link href={"/writing?lesson=" + lessonId}><span>06</span><div><strong>쓰기 · Viết</strong><small>{lesson.writing ? "1 bài viết" : "Chưa nhập"}</small></div></Link>
            </div>
          </article>

          <aside className="lesson-side-card">
            <span className="eyebrow">NHỊP HỌC GỢI Ý</span>
            <h3>25–35 phút</h3>
            <div className="time-plan"><span>5’</span><p>Từ vựng</p></div>
            <div className="time-plan"><span>7’</span><p>Ngữ pháp</p></div>
            <div className="time-plan"><span>8’</span><p>Nghe + Nói</p></div>
            <div className="time-plan"><span>10’</span><p>Đọc + Viết</p></div>
          </aside>
        </section>
      ) : null}

      {tab === "Từ vựng" ? (
        <section className="lesson-content-card">
          <div className="content-heading"><div><span className="eyebrow">어휘</span><h2>Từ vựng của bài</h2></div><Link className="secondary-button" href={"/vocabulary?lesson=" + lessonId}>Mở Flashcard</Link></div>
          {lesson.vocabulary.length ? (
            <div className="lesson-vocab-grid">
              {lesson.vocabulary.map((word) => (
                <article key={word.id}>
                  <button onClick={() => speak(word.ko)} aria-label={"Nghe " + word.ko}><Volume2 size={16} /></button>
                  <strong className="korean-text">{word.ko}</strong><span>{word.vi}</span><p className="korean-text">{word.example}</p>
                </article>
              ))}
            </div>
          ) : <div className="inline-empty-state">Nội dung từ vựng sẽ xuất hiện sau khi nhập giáo trình.</div>}
        </section>
      ) : null}

      {tab === "Ngữ pháp" ? (
        <section className="grammar-stack">
          {lesson.grammar.length ? lesson.grammar.map((grammar, index) => (
            <article className="grammar-card" key={grammar.id}>
              <div className="grammar-number">0{index + 1}</div>
              <div>
                <span className="eyebrow">문법</span><h2>{grammar.pattern}</h2><strong>{grammar.meaning}</strong><p>{grammar.explanation}</p>
                <div className="grammar-examples">{grammar.examples.map((example) => <button className="korean-text" onClick={() => speak(example)} key={example}><Volume2 size={15} /> {example}</button>)}</div>
              </div>
            </article>
          )) : <div className="inline-empty-state">Nội dung ngữ pháp sẽ xuất hiện sau khi nhập giáo trình.</div>}
        </section>
      ) : null}

      {tab === "Đọc" ? (
        lesson.reading ? (
          <section className="reading-card">
            <div className="reading-label"><BookOpen size={19} /><span>읽기</span></div>
            <h2>{lesson.reading.title}</h2><p className="reading-korean korean-text">{lesson.reading.text}</p>
            <details><summary>Xem nghĩa tiếng Việt</summary><p>{lesson.reading.translation}</p></details>
            <div className="reading-actions">
              <Link className="secondary-button" href={"/reading?lesson=" + lessonId}><BookOpen size={16} /> Làm đọc hiểu</Link>
              <Link className="secondary-button" href={"/listening?lesson=" + lessonId}><Headphones size={16} /> Luyện nghe</Link>
              <Link className="secondary-button" href={"/speaking?lesson=" + lessonId}><Mic2 size={16} /> Luyện nói</Link>
              <Link className="secondary-button" href={"/writing?lesson=" + lessonId}><PenLine size={16} /> Luyện viết</Link>
            </div>
          </section>
        ) : <div className="inline-empty-state">Bài đọc sẽ xuất hiện sau khi nhập giáo trình.</div>
      ) : null}
    </div>
  );
}
