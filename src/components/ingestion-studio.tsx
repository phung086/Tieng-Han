"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildLessonMedia } from "@/lib/lesson-media";
import { ingestionConfig } from "@/config/ingestion";
import { useLearning } from "@/lib/learning-state";
import type { LessonContent, StudyQuestion } from "@/data/content";
import { useMessages, type UiMessages } from "@/i18n/messages";

type ImportCopy = UiMessages["import"];

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

async function aiMapDocument(document: ExtractedDocument, copy: ImportCopy) {
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
      throw new Error(result.error || copy.mapError);
    }

    collected.push(...(result.starts ?? []));
  }

  return dedupeStarts(collected);
}

type SourcePageInput = {
  fileName: string;
  pageNumber: number;
  text: string;
  imageDataUrl?: string;
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
  copy: ImportCopy,
  revisionNotes: string[] = [],
) {
  const response = await fetch("/api/ingest/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, pages, revisionNotes }),
  });

  const payload = (await response.json()) as GeneratedPayload & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || copy.generateErrorPrefix + " " + copy.lessonLabel + " " + lessonId + ".");
  }

  if (!isGeneratedLesson(payload.lesson)) {
    throw new Error(copy.invalidGeneratedPrefix + " " + copy.lessonLabel + " " + lessonId + ".");
  }

  return payload as Required<Pick<GeneratedPayload, "lesson">> & GeneratedPayload;
}

async function validateGeneratedLesson(
  lesson: LessonContent,
  questions: StudyQuestion[],
  pages: SourcePageInput[],
  copy: ImportCopy,
) {
  const response = await fetch("/api/ingest/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson, questions, pages }),
  });

  const result = (await response.json()) as ValidationPayload;

  if (!response.ok) {
    throw new Error(result.error || copy.validateError);
  }

  return result;
}

export function IngestionStudio() {
  const { replaceCourse } = useContent();
  const { resetForCourse } = useLearning();
  const messages = useMessages();
  const copy = messages.import;
  const [files, setFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [maps, setMaps] = useState<DocumentMap[]>([]);
  const [courseTitle, setCourseTitle] = useState<string>(copy.defaultCourseTitle);
  const [level, setLevel] = useState<string>(copy.defaultLevel);
  const [edition, setEdition] = useState("");
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    contentModel: string;
    ocrModel: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "extracting" | "mapped" | "generating" | "done">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ocrUsed, setOcrUsed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/ingest/status")
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setAiStatus(result);
      })
      .catch(() => {
        if (!cancelled) setAiStatus({ configured: false, contentModel: "", ocrModel: "" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
  const likelyScanned = Boolean(
    totalPages && averageCharacters < ingestionConfig.pdf.lowTextCharacters,
  );

  async function analyzeFiles() {
    if (!files.length) return;

    if (aiStatus && !aiStatus.configured) {
      setError(copy.missingAiKey);
      return;
    }

    setError("");
    setStatus("extracting");
    setProgress(0);
    setMessage(copy.extracting);

    try {
      const nextDocuments: ExtractedDocument[] = [];
      const nextMaps: DocumentMap[] = [];

      setOcrUsed(false);

      for (let index = 0; index < files.length; index += 1) {
        let document = await extractPdf(files[index], index);

        if (lowTextRatio(document) >= ingestionConfig.pdf.ocrTriggerRatio) {
          setOcrUsed(true);
          setMessage(copy.ocrPrefix + " " + fileLabel(files[index].name) + "…");

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
        setMessage(copy.mappingPrefix + " " + fileLabel(files[index].name) + "…");

        const localStarts = localLessonStarts(document);
        const aiStarts = document.pages.some((page) => page.text.length > 30)
          ? await aiMapDocument(document, copy)
          : [];
        const starts = aiStarts.length ? aiStarts : localStarts;

        nextMaps.push({
          documentId: document.id,
          fileName: document.fileName,
          starts: dedupeStarts(starts),
        });

        if (index === 0) {
          setMessage(copy.detectingMetadata);
          const metadataResponse = await fetch("/api/ingest/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pages: document.pages.slice(0, 16).map((page) => ({
                fileName: page.fileName,
                pageNumber: page.pageNumber,
                text: page.text,
              })),
            }),
          });

          const metadata = (await metadataResponse.json()) as {
            title?: string;
            level?: string;
            edition?: string;
          };

          if (metadataResponse.ok) {
            if (metadata.title) setCourseTitle(metadata.title);
            if (metadata.level) setLevel(metadata.level);
            if (metadata.edition) setEdition(metadata.edition);
          }
        }

        setProgress(Math.round(((index + 1) / files.length) * 55));
      }

      if (!nextMaps[0]?.starts.length) {
        throw new Error(copy.noLessonMap);
      }

      setDocuments(nextDocuments);
      setMaps(nextMaps);
      setProgress(100);
      setMessage(copy.mapCompletePrefix + " " + nextMaps[0].starts.length + " " + copy.mapCompleteSuffix);
      setStatus("mapped");
    } catch (reason) {
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : copy.analyzeError);
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
          copy.generatingPrefix + " " + copy.lessonLabel + " " +
            lessonId +
            " · " +
            (index + 1) +
            "/" +
            lessonIds.length +
            "…",
        );

        const lessonPages = documents.flatMap((document) => {
          const map = maps.find((item) => item.documentId === document.id);
          if (!map) return [];
          return pagesForLesson(document, map.starts, lessonId);
        });

        const sourcePages = lessonPages.map((page) => ({
          fileName: page.fileName,
          pageNumber: page.pageNumber,
          text: page.text,
          imageDataUrl: page.previewImageDataUrl,
        }));

        const lessonMedia = buildLessonMedia(lessonPages);

        if (!sourcePages.length) continue;

        let payload = await requestGeneratedLesson(lessonId, sourcePages, copy);
        let lessonQuestions = (payload.questions ?? []).map((question) => ({
          ...question,
          lessonId,
        }));

        setMessage(
          copy.validatingPrefix + " " + copy.lessonLabel + " " +
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
          copy,
        );

        if (!validation.pass) {
          const revisionNotes = [
            ...validation.issues.map((item) => copy.revisionIssue + " " + item),
            ...validation.missingTopics.map((item) => copy.revisionMissing + " " + item),
          ];

          setMessage(copy.lessonLabel + " " + lessonId + " " + copy.repairPrefix);
          payload = await requestGeneratedLesson(lessonId, sourcePages, copy, revisionNotes);
          lessonQuestions = (payload.questions ?? []).map((question) => ({
            ...question,
            lessonId,
          }));

          validation = await validateGeneratedLesson(
            { ...payload.lesson, id: lessonId },
            lessonQuestions,
            sourcePages,
            copy,
          );
        }

        if (
          validation.coverageScore < ingestionConfig.validation.minimumCoverage ||
          validation.groundingScore < ingestionConfig.validation.minimumGrounding
        ) {
          throw new Error(
            copy.lessonLabel +
              " " +
              lessonId +
              " " +
              copy.qualityErrorPrefix +
              ": " +
              copy.coverageLabel +
              " " +
              validation.coverageScore +
              "%, " +
              copy.groundingLabel +
              " " +
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
          media: lessonMedia,
        });

        questions.push(...lessonQuestions);

        setProgress(Math.round(((index + 1) / lessonIds.length) * 100));
      }

      if (!lessons.length) {
        throw new Error(copy.noGeneratedLesson);
      }

      const runtimeCourse: RuntimeCourse = {
        id: "imported-" + Date.now(),
        title: courseTitle.trim() || copy.genericCourseTitle,
        level: level.trim() || copy.genericLevel,
        source: {
          fileName: files[0]?.name,
          fileNames: files.map((file) => file.name),
          importedAt: new Date().toISOString(),
          pageCount: totalPages,
          edition: edition || undefined,
          coverImageDataUrl:
            documents[0]?.pages[0]?.previewImageDataUrl,
        },
        lessons: lessons.sort((a, b) => a.id - b.id),
        questions,
      };

      resetForCourse();
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
        copy.importedPrefix +
          " " +
          runtimeCourse.lessons.length +
          " " +
          copy.importedLessons +
          ", " +
          runtimeCourse.questions.length +
          " " +
          copy.importedQuestions +
          " · " +
          runtimeCourse.lessons.reduce(
            (sum, lesson) => sum + (lesson.media?.length ?? 0),
            0,
          ) +
          " " +
          copy.importedMedia +
          " · " +
          copy.groundingAverage +
          " " +
          averageGrounding +
          "%.",
      );
    } catch (reason) {
      setStatus("mapped");
      setError(reason instanceof Error ? reason.message : copy.genericGenerateError);
    }
  }

  return (
    <div className="ingestion-studio">
      <section className="ingest-hero">
        <div>
          <span className="kicker">{copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <div className="ingest-hero-side">
          <div className="ingest-orb"><WandSparkles size={42} /></div>
          <span className={aiStatus?.configured ? "ai-ready-badge ready" : "ai-ready-badge"}>
            {aiStatus?.configured
              ? copy.aiReady + " · " + aiStatus.contentModel
              : aiStatus
                ? copy.aiMissing
                : copy.aiChecking}
          </span>
        </div>
      </section>

      <section className="ingest-grid">
        <article className="ingest-panel">
          <div className="ingest-panel-title">
            <span>01</span>
            <div><strong>{copy.chooseDocuments}</strong><small>{copy.orderHint}</small></div>
          </div>

          <label className="pdf-dropzone">
            <UploadCloud size={30} />
            <strong>{copy.choosePdf}</strong>
            <span>{copy.primaryHint}</span>
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
                    <span>{index === 0 ? copy.primary : copy.supplement} · {formatBytes(file.size)}</span>
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
            {copy.analyze}
          </button>
        </article>

        <article className="ingest-panel">
          <div className="ingest-panel-title">
            <span>02</span>
            <div><strong>{copy.mapTitle}</strong><small>{copy.mapHint}</small></div>
          </div>

          <div className="ingest-fields">
            <label>
              <span>{copy.courseName}</span>
              <input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} />
            </label>
            <label>
              <span>{copy.level}</span>
              <input value={level} onChange={(event) => setLevel(event.target.value)} />
            </label>
            <label>
              <span>{copy.edition}</span>
              <input
                placeholder={copy.autoDetect}
                value={edition}
                onChange={(event) => setEdition(event.target.value)}
              />
            </label>
          </div>

          {documents.length ? (
            <div className="ingest-metrics">
              <div><strong>{documents.length}</strong><span>{copy.pdf}</span></div>
              <div><strong>{totalPages}</strong><span>{copy.pages}</span></div>
              <div><strong>{lessonIds.length}</strong><span>{copy.lessons}</span></div>
              <div><strong>{averageCharacters}</strong><span>{copy.charsPerPage}</span></div>
            </div>
          ) : (
            <div className="ingest-placeholder">
              <BookOpenCheck size={28} />
              <span>{copy.mapPlaceholder}</span>
            </div>
          )}

          {lessonIds.length ? (
            <div className="detected-lessons">
              {primaryMap.starts.map((item, index) => {
                const next = primaryMap.starts[index + 1];
                return (
                  <div key={item.lessonId}>
                    <span>{copy.lessonLabel} {item.lessonId}</span>
                    <strong>p.{item.pageNumber}{next ? "–" + (next.pageNumber - 1) : "+"}</strong>
                    <small>{item.titleHint || copy.detectedTitle}</small>
                  </div>
                );
              })}
            </div>
          ) : null}

          {ocrUsed ? (
            <div className="ingest-warning">{copy.ocrUsed}</div>
          ) : likelyScanned ? (
            <div className="ingest-warning">{copy.lowText}</div>
          ) : null}
        </article>
      </section>

      <section className="ingest-run-card">
        <div className="ingest-run-copy">
          <span className="eyebrow">{copy.generateStep}</span>
          <h2>{copy.generateTitle}</h2>
          <p>{copy.generateBody}</p>
        </div>

        <button
          className="primary-button"
          disabled={status !== "mapped"}
          onClick={generateCourse}
        >
          {status === "generating" ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
          {copy.generate}
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
            <div><strong>{copy.successTitle}</strong><span>{message}</span></div>
            <Link className="primary-button" href="/learn">{copy.openCourse} <ArrowRight size={17} /></Link>
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
