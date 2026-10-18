"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import { sourcePages, sourceImageUrl, type BookPage, type LessonBookManifest } from "@/lib/lesson-book";
import styles from "./lesson-source-figures.module.css";

export function LessonSourceFigures({ lessonId, references, title }: { lessonId: number; references: (string | undefined)[]; title: string }) {
  const { course } = useContent();
  const [manifest, setManifest] = useState<LessonBookManifest | null>(null);
  const hasSource = Boolean(course.source?.importJobId || /^course-import-/.test(course.id));
  useEffect(() => {
    if (!hasSource) return;
    const controller = new AbortController();
    fetch("/api/courses/" + encodeURIComponent(course.id) + "/lesson-book?lesson=" + lessonId, { signal: controller.signal })
      .then(async response => { if (!response.ok) return; const data = await response.json(); if (!controller.signal.aborted) setManifest(data); })
      .catch(() => { /* The full book reader has explicit source recovery controls. */ });
    return () => controller.abort();
  }, [course.id, lessonId, hasSource]);
  if (!hasSource) return null;
  const pages = new Map<string, BookPage>();
  for (const reference of references) for (const page of sourcePages(reference, manifest?.documents ?? []).pages) pages.set(page.documentId + ":" + page.pageNumber, page);
  if (!pages.size) return <p><Link href={"/learn/" + lessonId}>Mở bài dưới dạng sách có hình</Link></p>;
  return <section className={styles.figures} aria-label={title}><header><h2>{title}</h2><p>Mở trang gốc để xem hình, bảng và ngữ cảnh cùng nội dung đang học.</p></header>
    <div className={styles.shelf}>{[...pages.values()].map(page => <figure key={page.documentId + page.pageNumber}><Link href={"/learn/" + lessonId + "?" + new URLSearchParams({ page: String(page.pageNumber), file: page.fileName })}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Private, same-course image route with lazy loading. */}
      <img src={sourceImageUrl(course.id, page)} alt={"Trang minh họa trong sách · " + page.fileName + " · trang PDF " + page.pageNumber} loading="lazy" decoding="async" />
      <figcaption>Trang PDF {page.pageNumber} · Mở sách</figcaption></Link></figure>)}</div>
  </section>;
}
