"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import type { LessonContent } from "@/data/content";
import { pageStudyContent, sourcePages, sourceImageUrl, type BookPage, type LessonBookManifest } from "@/lib/lesson-book";
import { useContent } from "@/lib/content-store";
import styles from "./lesson-book.module.css";
import {useLearning} from "@/lib/learning-state";
import {readPracticeSession,writePracticeSession} from "@/lib/practice-session-storage";

export function LessonBook({ courseId, lesson, initialPage, initialFile }: { courseId: string; lesson: LessonContent; initialPage?: number; initialFile?: string }) {
  const [manifest, setManifest] = useState<LessonBookManifest | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/courses/" + encodeURIComponent(courseId) + "/lesson-book?lesson=" + lesson.id, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Không mở được hình của bài học."); if (!controller.signal.aborted) { setManifest(data); setError(""); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không mở được sách."); });
    return () => controller.abort();
  }, [courseId, lesson.id, retry]);
  if (error) return <section className={styles.empty} role="alert"><BookOpen aria-hidden="true" size={28} /><h2>Chưa mở được trang sách có hình</h2><p>{error}</p>
    <div className={styles.actions}><button className="secondary-button" onClick={() => setRetry(value => value + 1)} type="button">Thử lại</button><Link href="/sources" className="secondary-button">Mở tài liệu nguồn</Link></div></section>;
  if (!manifest) return <div className={styles.skeleton} role="status">Đang mở sách có hình minh họa…</div>;
  if (!manifest.documents.some(document => document.pageCount > 0)) return <section className={styles.empty}><h2>Chưa có trang nguồn để đọc</h2><p>{manifest.issues.join(" · ")}</p><Link href="/sources" className="secondary-button">Mở tài liệu nguồn</Link></section>;
  return <BookReader key={courseId + ":" + lesson.id} courseId={courseId} lesson={lesson} manifest={manifest} initialPage={initialPage} initialFile={initialFile} />;
}

function BookReader({ courseId, lesson, manifest, initialPage, initialFile }: { courseId: string; lesson: LessonContent; manifest: LessonBookManifest; initialPage?: number; initialFile?: string }) {
  const { course } = useContent();
  const {state,progressScope,savePracticeSession}=useLearning();
  const documentPages = useMemo(() => manifest.documents.flatMap(document => Array.from({ length: document.pageCount }, (_, i): BookPage => ({ documentId: document.documentId, fileName: document.fileName, pageNumber: i + 1, role: "document" }))), [manifest.documents]);
  const storageKey = "haneul-book-position-v1:" + courseId + ":" + lesson.id;
  const [initial] = useState(() => {
    if (!manifest.pages.length) return { whole: true, index: 0 };
    if (initialPage) {
      const match = (page: BookPage) => page.pageNumber === initialPage && (!initialFile || page.fileName === initialFile);
      const found = manifest.pages.findIndex(match);
      if (found >= 0) return { whole: false, index: found };
      const original = documentPages.findIndex(match);
      if (original >= 0) return { whole: true, index: original };
    }
    try {
      const saved = JSON.parse(readPracticeSession(state,window.localStorage,progressScope,storageKey) || "null") as Partial<BookPage> | null;
      const whole = saved?.role === "document";
      const found = (whole ? documentPages : manifest.pages).findIndex(page => page.documentId === saved?.documentId && page.pageNumber === saved?.pageNumber);
      return { whole, index: Math.max(0, found) };
    } catch { return { whole: false, index: 0 }; }
  });
  const [wholeBook, setWholeBook] = useState(initial.whole);
  const [index, setIndex] = useState(initial.index);
  const [zoom, setZoom] = useState(1);
  const [showStudy, setShowStudy] = useState(true);
  const pages = wholeBook ? documentPages : manifest.pages;
  const current = pages[index];
  const owners = course.lessons.filter(item => sourcePages(item.sourceRef, manifest.documents).pages.some(page => page.role === "lesson" && page.documentId === current.documentId && page.pageNumber === current.pageNumber));
  const contextLesson = wholeBook && owners.length === 1 ? owners[0] : lesson;
  const context = useMemo(() => pageStudyContent(contextLesson, current, manifest.documents), [contextLesson, current, manifest.documents]);
  const hasContext = context.vocabulary.length + context.grammar.length + context.dialogues.length > 0;
  function navigate(next: number) {
    if (next < 0 || next >= pages.length) return;
    setIndex(next); setZoom(1);
    savePracticeSession(storageKey,JSON.stringify(pages[next]));
    try { writePracticeSession(window.localStorage,progressScope,storageKey,JSON.stringify(pages[next])); } catch { /* reading remains usable */ }
  }
  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = course.language?.locale ?? "ko-KR"; utterance.rate = .78;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }
  const relatedCount = manifest.pages.filter(page => page.role === "related").length;
  return <section className={styles.book} aria-label="Sách điện tử có hình minh họa">
    <header className={styles.header}><div><h2>Sách có hình · Bài {lesson.id}</h2><p>Tranh, bảng và bố cục từ trang sách gốc.</p></div>
      <label className={styles.toggle}><input type="checkbox" checked={showStudy} onChange={event => setShowStudy(event.target.checked)} />Học cùng trang</label></header>
    <div className={styles.toolbar}>
      <label className={styles.scope}>Phạm vi đọc<select aria-label="Phạm vi đọc sách" value={wholeBook ? "document" : "lesson"} onChange={event => {
        const whole = event.target.value === "document";
        const nextPages = whole ? documentPages : manifest.pages;
        const found = nextPages.findIndex(page => page.documentId === current.documentId && page.pageNumber === current.pageNumber);
        const next = Math.max(0, found);
        setWholeBook(whole); setIndex(next); setZoom(1);
        savePracticeSession(storageKey,JSON.stringify(nextPages[next]));
        try { writePracticeSession(window.localStorage,progressScope,storageKey,JSON.stringify(nextPages[next])); } catch { /* optional */ }
      }}><option value="lesson" disabled={!manifest.pages.length}>Bài đang học + trang liên quan</option><option value="document">Toàn bộ tài liệu · gồm nhập môn/phụ lục</option></select></label>
      <div className={styles.paging}><button type="button" aria-label="Trang trước của bài" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft aria-hidden="true" size={18} /></button>
        <label>{wholeBook ? "Trang trong tài liệu" : "Trang trong bài"}<select aria-label="Chọn trang sách trong bài" value={index} onChange={event => navigate(Number(event.target.value))}>
          {pages.map((page, i) => <option key={page.documentId + page.pageNumber} value={i}>{page.fileName} · trang PDF {page.pageNumber}{page.role === "related" ? " · liên quan/phụ lục" : ""}</option>)}
        </select></label>
        <button type="button" aria-label="Trang sau của bài" disabled={index === pages.length - 1} onClick={() => navigate(index + 1)}><ArrowRight aria-hidden="true" size={18} /></button></div>
      <div className={styles.zoom}><button type="button" disabled={zoom <= 1} aria-label="Thu nhỏ trang sách" onClick={() => setZoom(value => Math.max(1, value - .25))}><ZoomOut aria-hidden="true" size={18} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" disabled={zoom >= 2.5} aria-label="Phóng to trang sách" onClick={() => setZoom(value => Math.min(2.5, value + .25))}><ZoomIn aria-hidden="true" size={18} /></button></div>
    </div>
    <div className={showStudy ? styles.spread : styles.readOnly}>
      <div className={styles.paperColumn}>
        <BookPageImage key={"image:" + current.documentId + ":" + current.pageNumber} courseId={courseId} page={current} zoom={zoom} />
        <div className={styles.caption}><span>{index + 1}/{pages.length} {wholeBook ? "trang tài liệu" : "trang của bài"}{!wholeBook && relatedCount ? " · " + relatedCount + " trang liên quan/phụ lục" : ""}</span><Link href={"/sources?document=" + encodeURIComponent(current.documentId) + "&page=" + current.pageNumber}>Đối chiếu nguồn</Link></div>
        <PageTranscript key={"text:" + current.documentId + ":" + current.pageNumber} courseId={courseId} page={current} />
      </div>
      {showStudy ? <aside className={styles.study} aria-label="Nội dung học cùng trang">
        <h3>Học cùng trang {current.pageNumber}</h3><p>{hasContext ? "Bài " + contextLesson.id + " · " : ""}Những mục đã biên soạn có nguồn trỏ tới trang đang xem.</p>
        {context.vocabulary.length ? <details open><summary>Từ vựng · {context.vocabulary.length} mục</summary><dl className={styles.words}>{context.vocabulary.map(word => <div key={word.id}><dt><button type="button" aria-label={"Nghe từ " + word.ko} onClick={() => speak(word.ko)}><Volume2 aria-hidden="true" size={15} />{word.targetText || word.ko}</button></dt><dd>{word.learnerMeaning || word.vi}</dd></div>)}</dl></details> : null}
        {context.grammar.length ? <details open><summary>Ngữ pháp · {context.grammar.length} mẫu</summary><ul>{context.grammar.map(item => <li key={item.id}><strong className="korean-text">{item.pattern}</strong><p>{item.meaning}</p></li>)}</ul><Link href={"/grammar?lesson=" + contextLesson.id}>Đọc giải thích và ví dụ</Link></details> : null}
        {context.dialogues.length ? <details><summary>Hội thoại · {context.dialogues.length} đoạn</summary>{context.dialogues.map(dialogue => <div key={dialogue.id}>{dialogue.lines.map((line, i) => <p key={i}><strong>{line.speaker} {line.targetText || line.ko}</strong><br />{line.learnerMeaning || line.vi}</p>)}</div>)}</details> : null}
        {!hasContext ? <p>Tranh và nội dung của trang được giữ nguyên ở bên cạnh. Chưa có mục biên soạn được nối chính xác với trang này.</p> : null}
        <nav className={styles.studyLinks} aria-label="Học và luyện bài đang đọc"><Link href={"/vocabulary?lesson=" + contextLesson.id}>Ôn từ Bài {contextLesson.id}</Link><Link href={"/grammar?lesson=" + contextLesson.id}>Ngữ pháp Bài {contextLesson.id}</Link><Link href={"/practice?lesson=" + contextLesson.id + "#review-games"}>Chơi để nhớ</Link><Link href={"/practice/workbook?lesson=" + contextLesson.id}>Bài tập đầy đủ</Link></nav>
      </aside> : null}
    </div>
    <nav className={styles.bottomPaging} aria-label="Lật trang sách"><button type="button" className="secondary-button" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft aria-hidden="true" size={17} />Trang trước</button><span>Trang PDF {current.pageNumber}</span><button type="button" className="secondary-button" disabled={index === pages.length - 1} onClick={() => navigate(index + 1)}>Trang sau<ArrowRight aria-hidden="true" size={17} /></button></nav>
    {manifest.issues.length ? <details className={styles.issues}><summary>Các vị trí nguồn cần kiểm tra ({manifest.issues.length})</summary><ul>{manifest.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details> : null}
    <p className={styles.note}>Số trang PDF có thể khác số in trên sách. Xem đủ trang và hình không đồng nghĩa phần biên soạn đã được kiểm chứng đầy đủ.</p>
  </section>;
}

function BookPageImage({ courseId, page, zoom }: { courseId: string; page: BookPage; zoom: number }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  return <figure className={styles.pageFigure}>
    <div className={styles.pageScroll} tabIndex={0} role="region" aria-label="Trang sách có thể cuộn khi phóng to">
      {failed ? <div className={styles.imageError} role="alert"><h3>Chưa tải được ảnh trang {page.pageNumber}</h3><p>Trang vẫn có trong mục lục. Bạn có thể thử lại, đọc văn bản hoặc sang trang khác.</p><button type="button" className="secondary-button" onClick={() => { setFailed(false); setLoaded(false); setRetry(value => value + 1); }}><RotateCcw aria-hidden="true" size={16} />Tải lại ảnh</button></div> : <>
        {!loaded ? <p className={styles.imageLoading} role="status">Đang mở hình trang {page.pageNumber}…</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated local source pixels; do not proxy copyrighted originals through a public optimizer. */}
        <img src={sourceImageUrl(courseId, page) + "&retry=" + retry} alt={"Trang sách gốc " + page.pageNumber + " · " + page.fileName + " · gồm chữ, tranh và bảng trong nguồn"}
          width={700} height={990} style={{ width: zoom * 100 + "%" }} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      </>}
    </div><figcaption>{page.fileName} · trang PDF {page.pageNumber}</figcaption>
  </figure>;
}

function PageTranscript({ courseId, page }: { courseId: string; page: BookPage }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || text !== null) return;
    const controller = new AbortController();
    fetch("/api/courses/" + encodeURIComponent(courseId) + "/source?" + new URLSearchParams({ document: page.documentId, page: String(page.pageNumber), view: "text" }), { signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok || !result.page) throw Error(); if (!controller.signal.aborted) { setText(result.page.text || "Trang này chưa có văn bản trích xuất; hãy đọc ảnh nguồn."); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, text, courseId, page]);
  return <details className={styles.transcript} onToggle={event => setOpen(event.currentTarget.open)}><summary>Đọc văn bản hỗ trợ / dùng trình đọc màn hình</summary>
    {error ? <p role="alert">Chưa đọc được văn bản. Đóng và mở lại mục này để thử lại.</p> : <p>{text ?? "Đang mở văn bản…"}</p>}</details>;
}
