"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Headphones, Mic2, PenLine, Play, Volume2 } from "lucide-react";
import { lessonContent } from "@/data/content";

type LessonThree = typeof lessonContent[3];
const tabs = ["Tổng quan", "Từ vựng", "Ngữ pháp", "Đọc"] as const;

export function LessonWorkspace({ lessonId }: { lessonId: number }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tổng quan");
  const lesson = lessonContent[lessonId as keyof typeof lessonContent];

  if (!lesson || lessonId !== 3) {
    return (
      <div className="empty-lesson">
        <span className="eyebrow">DEMO CONTENT</span>
        <h1>{lesson?.title ?? `Bài ${lessonId}`}</h1>
        <p>Giao diện lesson đã sẵn sàng. Nội dung chi tiết demo hiện được hoàn thiện ở Bài 3 để mô phỏng dữ liệu sách thật.</p>
        <Link className="primary-button" href="/learn/3">Mở Bài 3 demo</Link>
      </div>
    );
  }

  const detail = lesson as LessonThree;

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
          <h1 className="korean-text">{detail.title}</h1>
          <p>{detail.vi} · {detail.objective}</p>
        </div>
        <Link className="primary-button" href="/practice/quiz"><Play size={17} /> Luyện bài này</Link>
      </header>

      <nav className="lesson-tabs" aria-label="Nội dung bài học">
        {tabs.map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </nav>

      {tab === "Tổng quan" ? (
        <section className="lesson-overview-grid">
          <article className="lesson-main-card">
            <span className="eyebrow">MỤC TIÊU BÀI HỌC</span>
            <h2>Nói được mình đi đâu và làm gì ở một địa điểm.</h2>
            <p>Luồng học đi từ nhận biết → hiểu → sử dụng → sản sinh, thay vì làm quiz ngẫu nhiên.</p>
            <div className="lesson-step-list">
              <button onClick={() => setTab("Từ vựng")}><span>01</span><div><strong>어휘 · Từ vựng</strong><small>6 từ địa điểm</small></div></button>
              <button onClick={() => setTab("Ngữ pháp")}><span>02</span><div><strong>문법 · Ngữ pháp</strong><small>에 / 에서</small></div></button>
              <Link href="/listening"><span>03</span><div><strong>듣기 · Nghe</strong><small>3 câu nghe hiểu</small></div></Link>
              <Link href="/speaking"><span>04</span><div><strong>말하기 · Nói</strong><small>Shadowing + nhận dạng</small></div></Link>
              <button onClick={() => setTab("Đọc")}><span>05</span><div><strong>읽기 · Đọc</strong><small>1 đoạn đọc hiểu</small></div></button>
              <Link href="/writing"><span>06</span><div><strong>쓰기 · Viết</strong><small>Viết 3–5 câu</small></div></Link>
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
          <div className="content-heading"><div><span className="eyebrow">어휘</span><h2>Từ vựng địa điểm</h2></div><Link className="secondary-button" href="/vocabulary">Mở Flashcard</Link></div>
          <div className="lesson-vocab-grid">
            {detail.vocabulary.map((word) => (
              <article key={word.ko}>
                <button onClick={() => speak(word.ko)} aria-label={`Nghe ${word.ko}`}><Volume2 size={16} /></button>
                <strong className="korean-text">{word.ko}</strong>
                <span>{word.vi}</span>
                <p className="korean-text">{word.example}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "Ngữ pháp" ? (
        <section className="grammar-stack">
          {detail.grammar.map((grammar, index) => (
            <article className="grammar-card" key={grammar.pattern}>
              <div className="grammar-number">0{index + 1}</div>
              <div>
                <span className="eyebrow">문법</span>
                <h2>{grammar.pattern}</h2>
                <strong>{grammar.meaning}</strong>
                <p>{grammar.explanation}</p>
                <div className="grammar-examples">
                  {grammar.examples.map((example) => <button className="korean-text" onClick={() => speak(example)} key={example}><Volume2 size={15} /> {example}</button>)}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "Đọc" ? (
        <section className="reading-card">
          <div className="reading-label"><BookOpen size={19} /><span>읽기</span></div>
          <h2>{detail.reading.title}</h2>
          <p className="reading-korean korean-text">{detail.reading.text}</p>
          <details><summary>Xem nghĩa tiếng Việt</summary><p>{detail.reading.translation}</p></details>
          <div className="reading-actions">
            <Link className="secondary-button" href="/reading"><BookOpen size={16} /> Làm đọc hiểu</Link>
            <Link className="secondary-button" href="/listening"><Headphones size={16} /> Nghe thêm</Link>
            <Link className="secondary-button" href="/speaking"><Mic2 size={16} /> Luyện nói</Link>
            <Link className="secondary-button" href="/writing"><PenLine size={16} /> Luyện viết</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
