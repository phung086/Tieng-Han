"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { coachEvidence, findCoachEvidence, type CoachEvidence } from "@/lib/lesson-coach";

export function LessonCoach({ lessonId, questionId, compact = false }: { lessonId: number; questionId?: string; compact?: boolean }) {
  const { course } = useContent();
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoachEvidence[] | null>(null);
  const [searched, setSearched] = useState("");
  const suggestions = coachEvidence(course, lessonId).filter(item => item.kind === "Ngữ pháp" || item.kind === "Từ vựng").slice(0, 4);
  function search(value: string) {
    if (!value.trim()) return;
    setQuery(value); setSearched(value);
    setResults(findCoachEvidence(course, lessonId, value, questionId));
  }
  return <details className={"lesson-coach" + (compact ? " compact" : "")}>
    <summary><BookOpen size={21} /><span><strong>Hỗ trợ từ giáo trình</strong><small>Tra nghĩa, mẫu câu và lời giải · Bài {lessonId}</small></span><ArrowRight size={18} /></summary>
    <div className="lesson-coach-body">
      <p>Nội dung trả lời được trích từ bài đang học. Khi giáo trình chưa có thông tin, Haneul sẽ báo rõ.</p>
      <form onSubmit={event => { event.preventDefault(); search(query); }}>
        <label htmlFor={fieldId}>Bạn muốn hiểu rõ từ hoặc mẫu câu nào?</label>
        <div className="coach-search"><input id={fieldId} value={query} onChange={event => setQuery(event.target.value)} maxLength={500} placeholder={suggestions[0] ? `Ví dụ: giải thích ${suggestions[0].title}` : "Nhập từ hoặc mẫu câu trong bài"} /><button className="primary-button" disabled={!query.trim()} type="submit"><Search size={17} />Tra cứu</button></div>
      </form>
      <div className="coach-suggestions" aria-label="Gợi ý tra cứu">
        {questionId ? <button type="button" onClick={() => search("Giải thích câu vừa làm")}>Giải thích câu vừa làm</button> : null}
        {suggestions.map(item => <button type="button" key={item.id} onClick={() => search(item.title)}>{item.title}</button>)}
      </div>
      <div className="coach-results" aria-live="polite" aria-atomic="true">
        {results?.length ? <><p>Tìm thấy {results.length} nội dung liên quan đến “{searched}”.</p>{results.map(item => <article key={item.id}>
          <div className="coach-result-title"><span>{item.kind}</span><h3 className="korean-text">{item.title}</h3></div>
          <p>{item.text}</p>{item.examples.length ? <ul>{item.examples.map((example, index) => <li key={index} className="korean-text">{example}</li>)}</ul> : null}
          <div className="coach-source"><small>Nguồn: {item.source}</small><Link href={item.href}>Luyện nội dung này <ArrowRight size={15} /></Link></div>
        </article>)}</> : results ? <div className="coach-no-result"><strong>Chưa tìm thấy thông tin này trong bài {lessonId}.</strong><p>Thử dùng từ tiếng Hàn hoặc chọn một mẫu câu gợi ý phía trên. Haneul không tự tạo lời giải khi thiếu nội dung nguồn.</p></div> : null}
      </div>
    </div>
  </details>;
}
