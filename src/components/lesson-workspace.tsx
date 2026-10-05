"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Headphones,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";

type LessonTab = "Tổng quan" | "Từ vựng" | "Ngữ pháp" | "Đọc" | "Bổ sung";
const tabs: LessonTab[] = ["Tổng quan", "Từ vựng", "Ngữ pháp", "Đọc", "Bổ sung"];

export function LessonWorkspace({ lessonId }: { lessonId: number }) {
  const [tab, setTab] = useState<LessonTab>("Tổng quan");
  const { state } = useLearning();
  const { getLesson, course } = useContent();
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

  const dialogues = lesson.dialogues ?? [];
  const pronunciation = lesson.pronunciation ?? [];
  const culture = lesson.culture ?? [];
  const extraSections = lesson.extraSections ?? [];
  const supplementalCount =
    dialogues.length + pronunciation.length + culture.length + extraSections.length;

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
          <span className="kicker">{course.level} · BÀI {lessonId}</span>
          <h1 className="korean-text">{lesson.title}</h1>
          <p>{lesson.vi} · {lesson.objective}</p>
          <div className="lesson-source-line">
            {lesson.sourceRef ? <span>{lesson.sourceRef}</span> : null}
            {lesson.quality ? (
              <span className="grounding-badge">
                <ShieldCheck size={13} />
                Grounding {lesson.quality.groundingScore}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="lesson-header-actions">
          <span className="lesson-progress-pill">{progress}% hoàn thành</span>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId}>
            <Play size={17} /> Luyện bài này
          </Link>
        </div>
      </header>

      <nav className="lesson-tabs" aria-label="Nội dung bài học">
        {tabs.map((item) => (
          <button
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Bổ sung" && supplementalCount ? (
              <span className="tab-count">{supplementalCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "Tổng quan" ? (
        <section className="lesson-overview-grid">
          <article className="lesson-main-card">
            <span className="eyebrow">MỤC TIÊU BÀI HỌC</span>
            <h2>{lesson.objective}</h2>
            <p>
              Tiến độ chính tính từ 6 kỹ năng. Hội thoại, phát âm, văn hóa và các mục
              đặc biệt của sách vẫn được giữ riêng trong tab Bổ sung.
            </p>
            <div className="lesson-step-list">
              <button onClick={() => setTab("Từ vựng")}>
                <span>01</span><div><strong>어휘 · Từ vựng</strong><small>{lesson.vocabulary.length} mục</small></div>
              </button>
              <button onClick={() => setTab("Ngữ pháp")}>
                <span>02</span><div><strong>문법 · Ngữ pháp</strong><small>{lesson.grammar.length} điểm</small></div>
              </button>
              <Link href={"/listening?lesson=" + lessonId}>
                <span>03</span><div><strong>듣기 · Nghe</strong><small>{lesson.listening.length} bài</small></div>
              </Link>
              <Link href={"/speaking?lesson=" + lessonId}>
                <span>04</span><div><strong>말하기 · Nói</strong><small>{lesson.speaking.length} câu luyện</small></div>
              </Link>
              <button onClick={() => setTab("Đọc")}>
                <span>05</span><div><strong>읽기 · Đọc</strong><small>{lesson.reading ? "1 bài đọc" : "Chưa có"}</small></div>
              </button>
              <Link href={"/writing?lesson=" + lessonId}>
                <span>06</span><div><strong>쓰기 · Viết</strong><small>{lesson.writing ? "1 bài viết" : "Chưa có"}</small></div>
              </Link>
              {supplementalCount ? (
                <button onClick={() => setTab("Bổ sung")}>
                  <span>+</span><div><strong>교재 · Nội dung bổ sung</strong><small>{supplementalCount} mục giữ từ sách</small></div>
                </button>
              ) : null}
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
          <div className="content-heading">
            <div><span className="eyebrow">어휘</span><h2>Từ vựng của bài</h2></div>
            <Link className="secondary-button" href={"/vocabulary?lesson=" + lessonId}>Mở Flashcard</Link>
          </div>
          {lesson.vocabulary.length ? (
            <div className="lesson-vocab-grid">
              {lesson.vocabulary.map((word) => (
                <article key={word.id}>
                  <button onClick={() => speak(word.ko)} aria-label={"Nghe " + word.ko}><Volume2 size={16} /></button>
                  <strong className="korean-text">{word.ko}</strong>
                  <span>{word.vi}</span>
                  <p className="korean-text">{word.example}</p>
                  {word.sourceRef ? <small className="source-ref">{word.sourceRef}</small> : null}
                </article>
              ))}
            </div>
          ) : <div className="inline-empty-state">Không có mục từ vựng riêng trong nguồn của bài này.</div>}
        </section>
      ) : null}

      {tab === "Ngữ pháp" ? (
        <section className="grammar-stack">
          {lesson.grammar.length ? lesson.grammar.map((grammar, index) => (
            <article className="grammar-card" key={grammar.id}>
              <div className="grammar-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <span className="eyebrow">문법</span>
                <h2>{grammar.pattern}</h2>
                <strong>{grammar.meaning}</strong>
                <p>{grammar.explanation}</p>
                <div className="grammar-examples">
                  {grammar.examples.map((example) => (
                    <button className="korean-text" onClick={() => speak(example)} key={example}>
                      <Volume2 size={15} /> {example}
                    </button>
                  ))}
                </div>
                {grammar.sourceRef ? <small className="source-ref">{grammar.sourceRef}</small> : null}
              </div>
            </article>
          )) : <div className="inline-empty-state">Không có điểm ngữ pháp riêng trong nguồn của bài này.</div>}
        </section>
      ) : null}

      {tab === "Đọc" ? (
        lesson.reading ? (
          <section className="reading-card">
            <div className="reading-label"><BookOpen size={19} /><span>읽기</span></div>
            <h2>{lesson.reading.title}</h2>
            <p className="reading-korean korean-text">{lesson.reading.text}</p>
            {lesson.reading.sourceRef ? <small className="source-ref">{lesson.reading.sourceRef}</small> : null}
            <details><summary>Xem nghĩa tiếng Việt</summary><p>{lesson.reading.translation}</p></details>
            <div className="reading-actions">
              <Link className="secondary-button" href={"/reading?lesson=" + lessonId}><BookOpen size={16} /> Làm đọc hiểu</Link>
              <Link className="secondary-button" href={"/listening?lesson=" + lessonId}><Headphones size={16} /> Luyện nghe</Link>
              <Link className="secondary-button" href={"/speaking?lesson=" + lessonId}><Mic2 size={16} /> Luyện nói</Link>
              <Link className="secondary-button" href={"/writing?lesson=" + lessonId}><PenLine size={16} /> Luyện viết</Link>
            </div>
          </section>
        ) : <div className="inline-empty-state">Bài này không có bài đọc riêng trong nguồn PDF.</div>
      ) : null}

      {tab === "Bổ sung" ? (
        <section className="supplement-stack">
          {!supplementalCount ? (
            <div className="inline-empty-state">Không có mục bổ sung riêng trong nguồn của bài này.</div>
          ) : null}

          {dialogues.map((dialogue) => (
            <article className="supplement-card" key={dialogue.id}>
              <div className="supplement-heading"><MessageCircle size={20} /><div><span className="eyebrow">HỘI THOẠI · 대화</span><h2>{dialogue.title || "Hội thoại"}</h2></div></div>
              <div className="dialogue-lines">
                {dialogue.lines.map((line, index) => (
                  <button key={dialogue.id + "-" + index} onClick={() => speak(line.ko)}>
                    <span>{line.speaker || String(index + 1)}</span>
                    <div><strong className="korean-text">{line.ko}</strong>{line.vi ? <small>{line.vi}</small> : null}</div>
                    <Volume2 size={15} />
                  </button>
                ))}
              </div>
              {dialogue.sourceRef ? <small className="source-ref">{dialogue.sourceRef}</small> : null}
            </article>
          ))}

          {pronunciation.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><Volume2 size={20} /><div><span className="eyebrow">PHÁT ÂM · 발음</span><h2>{item.title}</h2></div></div>
              <p>{item.explanation}</p>
              <div className="grammar-examples">{item.examples.map((example) => <button className="korean-text" key={example} onClick={() => speak(example)}><Volume2 size={15} /> {example}</button>)}</div>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}

          {culture.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><BookOpen size={20} /><div><span className="eyebrow">VĂN HÓA · 문화</span><h2>{item.title}</h2></div></div>
              <p>{item.text}</p>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}

          {extraSections.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><FileText size={20} /><div><span className="eyebrow">{item.kind}</span><h2>{item.title}</h2></div></div>
              <div className="extra-content">{item.content.map((line, index) => <p key={item.id + "-" + index}>{line}</p>)}</div>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
