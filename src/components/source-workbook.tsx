"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { useContent } from "@/lib/content-store";
import {useLearning} from "@/lib/learning-state";
import {readPracticeSession,writePracticeSession} from "@/lib/practice-session-storage";
import { LessonMediaGallery } from "@/components/lesson-media-gallery";
import { buildSourceWorkbook } from "@/lib/source-workbook";
import { isCurrentCompleteCoverage } from "@/lib/curriculum-coverage";

const WORKBOOK_PAGE_SIZE = 20;

function readProgress(input: string | null, valid: Set<string>): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(input || "[]");
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string" && valid.has(item))
      : [];
  } catch {
    return [];
  }
}

function readDrafts(input: string | null): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw: unknown = JSON.parse(input || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : {};
  } catch {
    return {};
  }
}

export function SourceWorkbook({ lessonId }: { lessonId: number }) {
  const { course, hydrated } = useContent();
  const {hydrated:learningReady,progressScope}=useLearning();
  if (!hydrated || !learningReady) return <p role="status">Đang mở nội dung bài học…</p>;
  // Remount when a server-loaded course replaces the initial empty course.
  return <WorkbookContent key={progressScope + ":" + course.id + ":" + lessonId} lessonId={lessonId} />;
}

function WorkbookContent({ lessonId }: { lessonId: number }) {
  const { getLesson, course } = useContent();
  const {state,progressScope,savePracticeSession}=useLearning();
  const read=(key:string)=>typeof window==="undefined"?null:readPracticeSession(state,window.localStorage,progressScope,key);
  const lesson = getLesson(lessonId);
  const items = useMemo(
    () => lesson ? buildSourceWorkbook(lesson, course.questions) : [],
    [lesson, course.questions],
  );
  const storageKey = "haneul-source-workbook-v1:" + course.id + ":" + lessonId;
  const draftKey = storageKey + ":drafts";
  const [done, setDone] = useState<string[]>(() =>
    readProgress(read(storageKey), new Set(items.map(item => item.id))),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() => readDrafts(read(draftKey)));
  const [revealed, setRevealed] = useState<string[]>([]);
  const [pageByCategory, setPageByCategory] = useState<Record<string, number>>({});

  if (!lesson) {
    return (
      <div className="empty-lesson">
        <h1>Không tìm thấy bài học</h1>
        <Link href="/learn">Quay lại lộ trình</Link>
      </div>
    );
  }

  const completed = new Set(done);
  const fallbackCategory = "Nguồn dự phòng · chưa tính là bài biên soạn";
  const practiceItems = items.filter(item => item.category !== fallbackCategory);
  const countDone = practiceItems.filter(item => completed.has(item.id)).length;
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  function toggleDone(id: string) {
    const next = completed.has(id) ? done.filter(item => item !== id) : [...done, id];
    setDone(next);
    savePracticeSession(storageKey,JSON.stringify(next));
    try {
      writePracticeSession(window.localStorage,progressScope,storageKey,JSON.stringify(next));
    } catch {
      // Browser storage is optional. Session checkmarks still work.
    }
  }

  function reset() {
    setDone([]);
    setDrafts({});
    setRevealed([]);
    savePracticeSession(storageKey,null);savePracticeSession(draftKey,null);
    try {
      writePracticeSession(window.localStorage,progressScope,storageKey,null);
      writePracticeSession(window.localStorage,progressScope,draftKey,null);
    } catch { /* optional */ }
  }

  function updateDraft(id: string, value: string) {
    const next = { ...drafts, [id]: value };
    setDrafts(next);
    savePracticeSession(draftKey,JSON.stringify(next));
    try { writePracticeSession(window.localStorage,progressScope,draftKey,JSON.stringify(next)); }
    catch { /* keep the session draft available */ }
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
          <span className="lesson-progress-pill">{countDone}/{practiceItems.length} mục đã luyện</span>
          <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId + "&mode=guided"}>
            Làm quiz toàn bài
          </Link>
        </div>
      </header>
      <section className="lesson-content-card">
        <div className="content-heading">
          <div>
            <span className="eyebrow">SỔ BÀI TẬP ĐÃ NHẬP</span>
            <h2>{grouped.size} nhóm · {practiceItems.length} mục luyện</h2>
          </div>
          <button className="secondary-button" type="button" onClick={reset}>
            <RotateCcw size={15} /> Làm lại từ đầu
          </button>
        </div>
        <div className="lab-progress" aria-label="Tiến độ sổ bài tập">
          <span style={{ width: (practiceItems.length ? (100 * countDone) / practiceItems.length : 0) + "%" }} />
        </div>
        <p>
          Mỗi mục được giữ riêng để không bị bỏ sót. Các mục chưa có đáp án trong dữ liệu nguồn
          được làm theo hình thức tự luyện, không bị chấm đúng/sai giả.
          Dấu hoàn thành là tự đánh giá, không thay cho bài kiểm tra.
        </p>
      </section>
      {!isCurrentCompleteCoverage(course.source?.curriculumCoverage) ? <section className="source-evidence-panel">
        <p>Bản biên soạn chưa được xác nhận bao phủ đầy đủ giáo trình. Số mục luyện chỉ tính nội dung đã nhập; bản chép nguyên trang không được tính vào tiến độ luyện.</p>
        <Link className="secondary-button" href="/sources">Đối chiếu toàn bộ giáo trình gốc</Link>
      </section> : null}
      {Array.from(grouped.entries()).map(([category, entries]) => {
        const isFallback = category === fallbackCategory;
        const doneCount = entries.filter(item => completed.has(item.id)).length;
        const pageCount = Math.max(1, Math.ceil(entries.length / WORKBOOK_PAGE_SIZE));
        const currentPage = Math.min(pageByCategory[category] ?? 0, pageCount - 1);
        const startIndex = currentPage * WORKBOOK_PAGE_SIZE;
        const endIndex = Math.min(startIndex + WORKBOOK_PAGE_SIZE, entries.length);
        const visibleEntries = entries.slice(startIndex, endIndex);
        return (
          <details className="lesson-content-card" key={category} open={doneCount !== entries.length}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "1.1rem" }}>
              {category} · {isFallback ? entries.length + " bản lưu" : doneCount + "/" + entries.length + " mục"}
            </summary>
            <div className="supplement-stack">
              {visibleEntries.map((item) => (
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
                  {!isFallback && (!item.answer || item.category === "Bài tập bổ sung") ? (
                    <div className="writing-area">
                      <textarea
                        aria-label={"Bài làm cho " + item.title}
                        placeholder="Viết câu trả lời, bản dịch hoặc ghi chú của bạn tại đây…"
                        value={drafts[item.id] ?? ""}
                        onChange={(event) => updateDraft(item.id, event.target.value)}
                      />
                    </div>
                  ) : null}
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
                    {!isFallback ? <button
                      className={completed.has(item.id) ? "secondary-button" : "primary-button"}
                      type="button"
                      onClick={() => toggleDone(item.id)}
                    >
                      {completed.has(item.id) ? "Đánh dấu chưa luyện" : "Đã luyện mục này"}
                    </button> : null}
                  </div>
                  {revealed.includes(item.id) && item.answer ? (
                    <p className="question-translation" style={{ whiteSpace: "pre-wrap" }}>
                      Đáp án / bản dịch: {item.answer}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            {pageCount > 1 ? (
              <nav className="complete-actions" aria-label={"Phân trang " + category}>
                <span aria-live="polite">
                  Trang {currentPage + 1}/{pageCount} · mục {startIndex + 1}–{endIndex}/{entries.length}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={"Trang trước trong nhóm " + category}
                  disabled={currentPage === 0}
                  onClick={() => setPageByCategory(current => ({ ...current, [category]: Math.max(0, currentPage - 1) }))}
                >
                  Trang trước
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={"Trang tiếp theo trong nhóm " + category}
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPageByCategory(current => ({ ...current, [category]: currentPage + 1 }))}
                >
                  Trang tiếp theo
                </button>
              </nav>
            ) : null}
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
