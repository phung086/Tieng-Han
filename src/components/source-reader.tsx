"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import type { ImportJobDocument, ImportJobPage } from "@/lib/import-jobs";
import styles from "./source-reader.module.css";
import { buildSourceReaderHref, parseSourceReaderLocation } from "@/lib/source-reader-navigation";

type SourceResponse = {
  documents: ImportJobDocument[]; courseTitle: string;
  documentId: string; pageNumber: number; page: ImportJobPage | null; error?: string;
};

export function SourceReader({ initialPage = 1, initialDocument = "" }: { initialPage?: number; initialDocument?: string }) {
  const { course, hydrated } = useContent();
  return hydrated ? <Reader key={[course.id, initialDocument, initialPage].join(":")} courseId={course.id} initialPage={initialPage} initialDocument={initialDocument} /> : <p role="status">Đang mở giáo trình…</p>;
}

function Reader({ courseId, initialPage, initialDocument }: { courseId: string; initialPage: number; initialDocument: string }) {
  const [documentId, setDocumentId] = useState(initialDocument);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [result, setResult] = useState<SourceResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(pageNumber) });
    if (documentId) query.set("document", documentId);
    fetch("/api/courses/" + encodeURIComponent(courseId) + "/source?" + query, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không đọc được nguồn.");
        setResult(data);
        setError("");
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không đọc được nguồn."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, documentId, pageNumber, retry]);

  useEffect(() => {
    function syncFromHistory() {
      const location = parseSourceReaderLocation(window.location.href);
      const changed = location.documentId !== documentId || location.page !== pageNumber;
      setDocumentId(location.documentId);
      setPageNumber(location.page);
      setPageInput(String(location.page));
      if (changed) setLoading(true);
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [documentId, pageNumber]);

  const currentDocument = result?.documents.find(item => item.documentId === (documentId || result.documentId));
  const page = loading || error ? null : result?.page;
  function navigate(number: number, nextDocumentId = documentId) {
    const sameLocation = number === pageNumber && nextDocumentId === documentId;
    if (sameLocation) setRetry(value => value + 1);
    setLoading(true);
    setDocumentId(nextDocumentId);
    setPageNumber(number);
    setPageInput(String(number));
    const href = buildSourceReaderHref(window.location.href, number, nextDocumentId);
    if (sameLocation) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }
  return <section className={styles.reader}>
    <header>
      <Link href="/learn">Về bài biên soạn</Link>
      <h1>Đối chiếu giáo trình gốc</h1>
      <p>{result?.courseTitle}</p>
      <p>Đọc toàn bộ trang đã lưu, gồm bài tập, hình, bảng và phụ lục. Bản nguồn được giữ riêng; xem hết trang không đồng nghĩa bài biên soạn đã đủ nội dung.</p>
    </header>
    {result ? <form className={styles.controls} onSubmit={event => { event.preventDefault(); const number = Number(pageInput); if (Number.isSafeInteger(number) && number >= 1 && number <= (currentDocument?.pageCount ?? 0)) navigate(number); }}>
      <label>Tài liệu<select value={documentId || result.documentId} onChange={event => navigate(1, event.target.value)}>
        {result.documents.map(item => <option key={item.documentId} value={item.documentId}>{item.fileName}</option>)}
      </select></label>
      <label>{currentDocument?.pagination === "logical-blocks" ? "Khối tài liệu" : "Trang PDF"}<input type="number" min={1} max={currentDocument?.pageCount} value={pageInput} onChange={event => setPageInput(event.target.value)} required /></label>
      <span>/ {currentDocument?.pageCount}</span>
      <button className="secondary-button" type="submit" disabled={loading}>Mở trang</button>
      <button className="secondary-button" type="button" disabled={loading || pageNumber <= 1} onClick={() => navigate(pageNumber - 1)}>Trang trước</button>
      <button className="secondary-button" type="button" disabled={loading || pageNumber >= (currentDocument?.pageCount ?? 0)} onClick={() => navigate(pageNumber + 1)}>Trang sau</button>
    </form> : null}
    {loading ? <p role="status">Đang tải trang nguồn…</p> : null}
    {error ? <div role="alert"><p>{error}</p><button className="secondary-button" onClick={() => { setLoading(true); setRetry(retry + 1); }}>Thử đọc lại nguồn</button>{pageNumber !== 1 ? <button className="secondary-button" onClick={() => navigate(1)}>Mở từ trang đầu</button> : null}</div> : null}
    {!loading && !error && result && !page ? <p role="alert">{result.error}</p> : null}
    {page ? <article className={styles.page}>
      <h2>{page.fileName} · {page.sourceLocation || "trang PDF " + page.pageNumber}</h2>
      <p>Số trang PDF là vị trí trong file; có thể khác số in trên sách.</p>
      {page.extractionIssues?.length ? <p role="alert">Cần kiểm tra trích xuất: {page.extractionIssues.join(" · ")}</p> : null}
      {page.previewImageDataUrl && /^data:image\/(png|jpeg|webp);base64,/.test(page.previewImageDataUrl) ?
        /* eslint-disable-next-line @next/next/no-img-element -- Original local snapshot, no remote optimizer. */
        <img src={page.previewImageDataUrl} alt={"Ảnh nguyên trang " + page.pageNumber + " · " + page.fileName} /> : <p>Chưa lưu ảnh trang này. Văn bản trích xuất chưa đủ xác minh hình, bảng hoặc bố cục.</p>}
      <h3>Văn bản trích xuất nguyên vẹn</h3>
      <p className={styles.transcript}>{page.text || "Không có văn bản trích xuất. Cần đọc ảnh hoặc khôi phục OCR."}</p>
      {page.embeddedImages?.length ? <details><summary>Mở từng hình trích xuất trong trang ({page.embeddedImages.length})</summary>{page.embeddedImages.filter(item => /^data:image\/(png|jpeg|webp);base64,/.test(item.dataUrl)).map(item =>
        /* eslint-disable-next-line @next/next/no-img-element -- Embedded original source asset. */
        <img key={item.id} src={item.dataUrl} alt={"Hình trích xuất " + item.id + " · trang " + page.pageNumber} />)}</details> : null}
      {page.externalLinks?.length ? <div><h3>Tài nguyên được liên kết trong trang</h3><ul>{page.externalLinks.filter(url => /^https?:\/\//i.test(url)).map((url, index) => <li key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></div> : null}
    </article> : null}
  </section>;
}
