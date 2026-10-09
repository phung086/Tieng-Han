"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import { LessonMediaGallery } from "@/components/lesson-media-gallery";
import { buildSourceWorkbook } from "@/lib/source-workbook";

export function SourceWorkbook({ lessonId }: { lessonId: number }) {
  const { getLesson, course } = useContent();
  const lesson = getLesson(lessonId);
  const items = useMemo(
    () => lesson ? buildSourceWorkbook(lesson, course.questions) : [],
    [lesson, course.questions],
  );
  const storageKey = "haneul-source-workbook-v1:" + course.id + ":" + lessonId;
  const [done, setDone] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      const valid = new Set(items.map(item => item.id));
      setDone(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && valid.has(id)) : []);
    } catch {
      setDone([]);
    }
    setRevealed([]);
  }, [storageKey, items]);

  if (!lesson) {
    return (
      <div className="empty-lesson">
        <h1>Không tìm thấy bài học</h1>
        <Link href="/learn">Quay lại lộ trình</Link>
      </div>
    );
  }

  const completed = new Set(done);
  const countDone = items.filter(item => completed.has(item.id)).length;
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  function toggleDone(id: string) {
    const next = completed.has(id) ? done.filter(item => item !== id) : [...done, id];
    setDone(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Browser storage is optional. Session checkmarks still work.
    }
  }

  function reset() {
    setDone([]);
    setRevealed([]);
    try { window.localStorage.removeItem(storageKey); } catch { /* optional */ }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="lesson-workspace">
      <header className="lesson-workspace-header">
        <div>
          <span className="kicker">SỔ LUYỆN TẬP NGUỒN · BÀI {lessonId}</span>
          <h1>Luyện đủ từng mục trong bài</h1>
          <p>{lesson.title} · {lesson.vi}</p>
          <p>
            Tất cả mục hiện có trong dữ liệu bài học: từ mới, câu ví dụ, hội thoại,
            bài đọc, câu hỏi, ngữ pháp và nội dung bổ sung. Không giới hạn 5–10 câu.
          </p>
        </div>
        <div className="lesson-header-actions">
          <span className="lesson-progress-pill">{countDone}/{items.length} mục đã luyện</span>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId + "&mode=guided"}>
            Làm quiz toàn bài
          </Link>
        </div>
      </header>
      <section className="lesson-content-card">
        <div className="content-heading">
          <div>
            <span className="eyebrow">SỔ BÀI TẬP ĐẦY ĐỦ</span>
            <h2>{grouped.size} nhóm · {items.length} mục</h2>
          </div>
          <button className="secondary-button" type="button" onClick={reset}>
            <RotateCcw size={15} /> Làm lại từ đầu
          </button>
        </div>
        <div className="lab-progress" aria-label="Tiến độ sổ bài tập">
          <span style={{ width: (items.length ? (100 * countDone) / items.length : 0) + "%" }} />
        </div>
        <p>
          Mỗi mục được giữ riêng để không bị bỏ sót. Các mục chưa có đáp án trong dữ liệu nguồn
          được làm theo hình thức tự luyện, không bị chấm đúng/sai giả.
          Dấu hoàn thành là tự đánh giá, không thay cho bài kiểm tra.
        </p>
      </section>
      {Array.from(grouped.entries()).map(([category, entries]) => {
        const doneCount = entries.filter(item => completed.has(item.id)).length;
        return (
          <details className="lesson-content-card" key={category} open={doneCount !== entries.length}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "1.1rem" }}>
              {category} · {doneCount}/{entries.length} mục
            </summary>
            <div className="supplement-stack">
              {entries.map((item) => (
                <article className="supplement-card" key={item.id}>
                  <div className="supplement-heading">
                    {completed.has(item.id) ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                    <div>
                      <span className="eyebrow">{category}</span>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  <p className="korean-text" style={{ whiteSpace: "pre-wrap" }}>{item.prompt}</p>
                  {item.choices?.length ? (
                    <div className="extra-content">
                      {item.choices.map((choice, index) => (
                        <p key={index}>{String.fromCharCode(65 + index)}. {choice}</p>
                      ))}
                    </div>
                  ) : null}
                  {item.hint ? <p>{item.hint}</p> : null}
                  {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
                  <div className="complete-actions">
                    {item.answer ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setRevealed(current =>
                          current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id],
                        )}
                      >
                        {revealed.includes(item.id) ? "Ẩn đáp án / bản dịch" : "Xem đáp án / bản dịch"}
                      </button>
                    ) : null}
                    <button type="button" className="secondary-button" onClick={() => speak(item.prompt)}>
                      Nghe câu nguồn
                    </button>
                    <button
                      className={completed.has(item.id) ? "secondary-button" : "primary-button"}
                      type="button"
                      onClick={() => toggleDone(item.id)}
                    >
                      {completed.has(item.id) ? "Đánh dấu chưa luyện" : "Đã luyện mục này"}
                    </button>
                  </div>
                  {revealed.includes(item.id) && item.answer ? (
                    <p className="question-translation" style={{ whiteSpace: "pre-wrap" }}>
                      Đáp án / bản dịch: {item.answer}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </details>
        );
      })}
      <LessonMediaGallery media={lesson.media ?? []} />
      <div className="complete-actions">
        <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId + "&mode=mastery"}>
          Làm bài kiểm tra toàn bộ câu hỏi
        </Link>
        <Link className="secondary-button" href={"/learn/" + lessonId}>
          Về bài học
        </Link>
      </div>
    </div>
  );
}
