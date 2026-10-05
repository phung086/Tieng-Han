"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import {
  extractPdf,
  localLessonStarts,
  lowTextRatio,
  ocrLowTextPages,
  pagesForLesson,
  type ExtractedDocument,
} from "@/lib/pdf-extractor";
import { useContent, type RuntimeCourse } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import type { LessonContent, StudyQuestion } from "@/data/content";

type LessonStart = {
  lessonId: number;
  pageNumber: number;
  titleHint: string;
};

type DocumentMap = {
  documentId: string;
  fileName: string;
  starts: LessonStart[];
};

type GeneratedPayload = {
  lesson?: LessonContent;
  questions?: StudyQuestion[];
};

function dedupeStarts(starts: LessonStart[]) {
  const byLesson = new Map<number, LessonStart>();

  for (const item of starts) {
    const existing = byLesson.get(item.lessonId);
    if (!existing || item.pageNumber < existing.pageNumber) {
      byLesson.set(item.lessonId, item);
    }
  }

  return [...byLesson.values()].sort((a, b) => a.lessonId - b.lessonId);
}

function isGeneratedLesson(value: unknown): value is LessonContent {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    Number.isFinite(Number(row.id)) &&
    typeof row.title === "string" &&
    typeof row.vi === "string" &&
    typeof row.objective === "string" &&
    Array.isArray(row.vocabulary) &&
    Array.isArray(row.grammar) &&
    Array.isArray(row.listening) &&
    Array.isArray(row.speaking)
  );
}

async function aiMapDocument(document: ExtractedDocument) {
  const collected: LessonStart[] = [];
  const chunkSize = 35;

  for (let offset = 0; offset < document.pages.length; offset += chunkSize) {
    const pages = document.pages.slice(offset, offset + chunkSize).map((page) => ({
      fileName: page.fileName,
      pageNumber: page.pageNumber,
      text: page.text.slice(0, 2800),
    }));

    const response = await fetch("/api/ingest/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    });

    const result = (await response.json()) as {
      starts?: LessonStart[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Không thể phân tích cấu trúc PDF.");
    }

    collected.push(...(result.starts ?? []));
  }

  return dedupeStarts(collected);
}

type SourcePageInput = {
  fileName: string;
  pageNumber: number;
  text: string;
};

type ValidationPayload = {
  coverageScore: number;
  groundingScore: number;
  issues: string[];
  missingTopics: string[];
  pass: boolean;
  error?: string;
};

async function requestGeneratedLesson(
  lessonId: number,
  pages: SourcePageInput[],
  revisionNotes: string[] = [],
) {
  const response = await fetch("/api/ingest/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, pages, revisionNotes }),
  });

  const payload = (await response.json()) as GeneratedPayload & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Không thể sinh Bài " + lessonId + ".");
  }

  if (!isGeneratedLesson(payload.lesson)) {
    throw new Error("AI trả về dữ liệu không hợp lệ cho Bài " + lessonId + ".");
  }

  return payload as Required<Pick<GeneratedPayload, "lesson">> & GeneratedPayload;
}

async function validateGeneratedLesson(
  lesson: LessonContent,
  questions: StudyQuestion[],
  pages: SourcePageInput[],
) {
  const response = await fetch("/api/ingest/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson, questions, pages }),
  });

  const result = (await response.json()) as ValidationPayload;

  if (!response.ok) {
    throw new Error(result.error || "Không thể kiểm định nội dung bài học.");
  }

  return result;
}

export function IngestionStudio() {
  const { replaceCourse } = useContent();
  const { resetProgress } = useLearning();
  const [files, setFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [maps, setMaps] = useState<DocumentMap[]>([]);
  const [courseTitle, setCourseTitle] = useState("Tiếng Hàn Sơ cấp 1");
  const [level, setLevel] = useState("초급 1");
  const [status, setStatus] = useState<"idle" | "extracting" | "mapped" | "generating" | "done">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ocrUsed, setOcrUsed] = useState(false);

  const primaryMap = maps[0];
  const lessonIds = useMemo(
    () => primaryMap?.starts.map((item) => item.lessonId) ?? [],
    [primaryMap],
  );

  const totalPages = documents.reduce((sum, document) => sum + document.pageCount, 0);
  const totalCharacters = documents.reduce(
    (sum, document) => sum + document.pages.reduce((pageSum, page) => pageSum + page.text.length, 0),
    0,
  );
  const averageCharacters = totalPages ? Math.round(totalCharacters / totalPages) : 0;
  const likelyScanned = Boolean(totalPages && averageCharacters < 80);

  async function analyzeFiles() {
    if (!files.length) return;

    setError("");
    setStatus("extracting");
    setProgress(0);
    setMessage("Đang trích xuất text từ PDF…");

    try {
      const nextDocuments: ExtractedDocument[] = [];
      const nextMaps: DocumentMap[] = [];

      setOcrUsed(false);

      for (let index = 0; index < files.length; index += 1) {
        let document = await extractPdf(files[index], index);

        if (lowTextRatio(document) >= 0.35) {
          setOcrUsed(true);
          setMessage("PDF scan: đang OCR " + fileLabel(files[index].name) + "…");

          document = await ocrLowTextPages(
            files[index],
            document,
            (completed, total) => {
              const fileBase = index / files.length;
              const fileShare = 1 / files.length;
              const ocrShare = total ? completed / total : 0;
              setProgress(Math.round((fileBase + fileShare * ocrShare * 0.4) * 55));
            },
          );
        }

        nextDocuments.push(document);

        setProgress(Math.round(((index + 0.45) / files.length) * 45));
        setMessage("Đang nhận diện bài học trong " + fileLabel(files[index].name) + "…");

        let starts = localLessonStarts(document);

        if (starts.length < 2 && document.pages.some((page) => page.text.length > 30)) {
          starts = await aiMapDocument(document);
        }

        nextMaps.push({
          documentId: document.id,
          fileName: document.fileName,
          starts: dedupeStarts(starts),
        });

        setProgress(Math.round(((index + 1) / files.length) * 55));
      }

      if (!nextMaps[0]?.starts.length) {
        throw new Error(
          "Không nhận diện được cấu trúc bài học. PDF có thể là bản scan không có text layer hoặc tiêu đề bài quá khác chuẩn.",
        );
      }

      setDocuments(nextDocuments);
      setMaps(nextMaps);
      setProgress(100);
      setMessage("Đã lập bản đồ " + nextMaps[0].starts.length + " bài từ giáo trình chính.");
      setStatus("mapped");
    } catch (reason) {
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : "Không thể phân tích PDF.");
    }
  }

  async function generateCourse() {
    if (!documents.length || !lessonIds.length) return;

    setError("");
    setStatus("generating");
    setProgress(0);

    try {
      const lessons: LessonContent[] = [];
      const questions: StudyQuestion[] = [];

      for (let index = 0; index < lessonIds.length; index += 1) {
        const lessonId = lessonIds[index];
        setMessage(
          "Đang biên Bài " +
            lessonId +
            " · " +
            (index + 1) +
            "/" +
            lessonIds.length +
            "…",
        );

        const sourcePages = documents.flatMap((document) => {
          const map = maps.find((item) => item.documentId === document.id);
          if (!map) return [];

          return pagesForLesson(document, map.starts, lessonId).map((page) => ({
            fileName: page.fileName,
            pageNumber: page.pageNumber,
            text: page.text,
          }));
        });

        if (!sourcePages.length) continue;

        let payload = await requestGeneratedLesson(lessonId, sourcePages);
        let lessonQuestions = (payload.questions ?? []).map((question) => ({
          ...question,
          lessonId,
        }));

        setMessage(
          "Đang kiểm định Bài " +
            lessonId +
            " · " +
            (index + 1) +
            "/" +
            lessonIds.length +
            "…",
        );

        let validation = await validateGeneratedLesson(
          { ...payload.lesson, id: lessonId },
          lessonQuestions,
          sourcePages,
        );

        if (!validation.pass) {
          const revisionNotes = [
            ...validation.issues.map((item) => "Lỗi: " + item),
            ...validation.missingTopics.map((item) => "Thiếu: " + item),
          ];

          setMessage("Bài " + lessonId + " chưa đạt QA, đang tự biên lại…");
          payload = await requestGeneratedLesson(lessonId, sourcePages, revisionNotes);
          lessonQuestions = (payload.questions ?? []).map((question) => ({
            ...question,
            lessonId,
          }));

          validation = await validateGeneratedLesson(
            { ...payload.lesson, id: lessonId },
            lessonQuestions,
            sourcePages,
          );
        }

        if (validation.coverageScore < 75 || validation.groundingScore < 85) {
          throw new Error(
            "Bài " +
              lessonId +
              " không đạt ngưỡng kiểm định sau lần tự sửa: coverage " +
              validation.coverageScore +
              "%, grounding " +
              validation.groundingScore +
              "%.",
          );
        }

        lessons.push({
          ...payload.lesson,
          id: lessonId,
          quality: {
            coverageScore: validation.coverageScore,
            groundingScore: validation.groundingScore,
            issues: validation.issues,
            missingTopics: validation.missingTopics,
          },
        });

        questions.push(...lessonQuestions);

        setProgress(Math.round(((index + 1) / lessonIds.length) * 100));
      }

      if (!lessons.length) {
        throw new Error("Không có bài học nào được sinh thành công.");
      }

      const runtimeCourse: RuntimeCourse = {
        id: "imported-" + Date.now(),
        title: courseTitle.trim() || "Giáo trình đã nhập",
        level: level.trim() || "Korean",
        source: {
          fileName: files[0]?.name,
          fileNames: files.map((file) => file.name),
          importedAt: new Date().toISOString(),
          pageCount: totalPages,
        },
        lessons: lessons.sort((a, b) => a.id - b.id),
        questions,
      };

      resetProgress();
      replaceCourse(runtimeCourse);
      setStatus("done");
      setProgress(100);
      const averageGrounding = Math.round(
        runtimeCourse.lessons.reduce(
          (sum, lesson) => sum + (lesson.quality?.groundingScore ?? 0),
          0,
        ) / runtimeCourse.lessons.length,
      );

      setMessage(
        "Đã nhập " +
          runtimeCourse.lessons.length +
          " bài, " +
          runtimeCourse.questions.length +
          " câu luyện · grounding trung bình " +
          averageGrounding +
          "%.",
      );
    } catch (reason) {
      setStatus("mapped");
      setError(reason instanceof Error ? reason.message : "Không thể tạo giáo trình.");
    }
  }

  return (
    <div className="ingestion-studio">
      <section className="ingest-hero">
        <div>
          <span className="kicker">CONTENT INGESTION · 교재 가져오기</span>
          <h1>Thả PDF vào, Haneul tự dựng giáo trình học.</h1>
          <p>
            PDF chỉ được đọc trong phiên import. AI xử lý theo từng bài và mọi kiến thức
            được yêu cầu giữ nguồn trang để hạn chế sinh nội dung lệch sách.
          </p>
        </div>
        <div className="ingest-orb"><WandSparkles size={42} /></div>
      </section>

      <section className="ingest-grid">
        <article className="ingest-panel">
          <div className="ingest-panel-title">
            <span>01</span>
            <div><strong>Chọn tài liệu</strong><small>Giáo trình chính trước, workbook sau</small></div>
          </div>

          <label className="pdf-dropzone">
            <UploadCloud size={30} />
            <strong>Chọn một hoặc nhiều PDF</strong>
            <span>PDF đầu tiên được dùng để xác định thứ tự bài học.</span>
            <input
              accept="application/pdf,.pdf"
              multiple
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                setDocuments([]);
                setMaps([]);
                setStatus("idle");
                setError("");
              }}
              type="file"
            />
          </label>

          {files.length ? (
            <div className="file-stack">
              {files.map((file, index) => (
                <div className="file-row" key={file.name + file.size}>
                  <FileText size={18} />
                  <div>
                    <strong>{file.name}</strong>
                    <span>{index === 0 ? "Giáo trình chính" : "Tài liệu bổ sung"} · {formatBytes(file.size)}</span>
                  </div>
                  <span className="file-order">0{index + 1}</span>
                </div>
              ))}
            </div>
          ) : null}

          <button
            className="primary-button ingest-main-button"
            disabled={!files.length || status === "extracting" || status === "generating"}
            onClick={analyzeFiles}
          >
            {status === "extracting" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
            Phân tích cấu trúc sách
          </button>
        </article>

        <article className="ingest-panel">
          <div className="ingest-panel-title">
            <span>02</span>
            <div><strong>Bản đồ giáo trình</strong><small>Kiểm tra trước khi biên toàn bộ bài</small></div>
          </div>

          <div className="ingest-fields">
            <label>
              <span>Tên giáo trình</span>
              <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} />
            </label>
            <label>
              <span>Cấp độ</span>
              <input value={level} onChange={(event) => setLevel(event.target.value)} />
            </label>
          </div>

          {documents.length ? (
            <div className="ingest-metrics">
              <div><strong>{documents.length}</strong><span>PDF</span></div>
              <div><strong>{totalPages}</strong><span>trang</span></div>
              <div><strong>{lessonIds.length}</strong><span>bài</span></div>
              <div><strong>{averageCharacters}</strong><span>ký tự/trang</span></div>
            </div>
          ) : (
            <div className="ingest-placeholder">
              <BookOpenCheck size={28} />
              <span>Bản đồ bài học sẽ xuất hiện sau khi phân tích PDF.</span>
            </div>
          )}

          {lessonIds.length ? (
            <div className="detected-lessons">
              {primaryMap.starts.map((item, index) => {
                const next = primaryMap.starts[index + 1];
                return (
                  <div key={item.lessonId}>
                    <span>Bài {item.lessonId}</span>
                    <strong>p.{item.pageNumber}{next ? "–" + (next.pageNumber - 1) : "+"}</strong>
                    <small>{item.titleHint || "Đã nhận diện tiêu đề bài"}</small>
                  </div>
                );
              })}
            </div>
          ) : null}

          {ocrUsed ? (
            <div className="ingest-warning">
              Đã dùng vision OCR cho các trang thiếu text layer. Hãy kiểm tra nhanh bản đồ bài học trước khi tạo toàn bộ giáo trình.
            </div>
          ) : likelyScanned ? (
            <div className="ingest-warning">
              Một số trang vẫn có rất ít text sau phân tích. Nội dung đó sẽ được đánh dấu cần kiểm tra khi biên bài.
            </div>
          ) : null}
        </article>
      </section>

      <section className="ingest-run-card">
        <div className="ingest-run-copy">
          <span className="eyebrow">03 · GENERATE</span>
          <h2>Tạo toàn bộ nội dung học tập</h2>
          <p>
            Mỗi bài được xử lý riêng: vocabulary, grammar, listening transcript nếu có,
            speaking, reading, writing và quiz. Không có nội dung nguồn thì không tự bịa phần đó.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={status !== "mapped"}
          onClick={generateCourse}
        >
          {status === "generating" ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
          Tạo giáo trình
        </button>

        {(status === "extracting" || status === "generating" || status === "done") ? (
          <div className="ingest-progress-wrap">
            <div className="ingest-progress"><span style={{ width: progress + "%" }} /></div>
            <div className="ingest-progress-label"><span>{message}</span><strong>{progress}%</strong></div>
          </div>
        ) : null}

        {error ? <div className="ingest-error">{error}</div> : null}

        {status === "done" ? (
          <div className="ingest-success">
            <CheckCircle2 size={24} />
            <div><strong>Giáo trình đã sẵn sàng để học.</strong><span>{message}</span></div>
            <Link className="primary-button" href="/learn">Mở giáo trình <ArrowRight size={17} /></Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function fileLabel(name: string) {
  return name.length > 36 ? name.slice(0, 33) + "…" : name;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
