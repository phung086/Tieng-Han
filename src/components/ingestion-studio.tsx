"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Copy,
  Download,
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
import {
  normalizeLessonContent,
  parseCourseBundle,
} from "@/lib/course-bundle";
import {
  buildChatGptPrompt,
  buildHandoffPackage,
  downloadJsonFile,
  handoffFileName,
  verifyBundleSource,
} from "@/lib/chatgpt-handoff";
import {
  consumeMcpImportJob,
  getMcpImportJob,
  queueMcpImportJob,
  requeueMcpImportJob,
} from "@/lib/mcp-import-client";
import type { ImportJobStatus } from "@/lib/import-jobs";
import {
  defaultLanguageProfile,
  getLanguageProfile,
  type LanguageProfile,
} from "@/lib/language-profile";

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
    (typeof row.targetTitle === "string" ||
      typeof row.title === "string") &&
    (typeof row.learnerTitle === "string" ||
      typeof row.vi === "string") &&
    typeof row.objective === "string" &&
    Array.isArray(row.vocabulary) &&
    Array.isArray(row.grammar) &&
    Array.isArray(row.listening) &&
    Array.isArray(row.speaking)
  );
}

async function aiMapDocument(
  document: ExtractedDocument,
  copy: ImportCopy,
  language: LanguageProfile,
) {
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
      body: JSON.stringify({ pages, language }),
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
  language: LanguageProfile,
  revisionNotes: string[] = [],
) {
  const response = await fetch("/api/ingest/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lessonId,
      pages,
      revisionNotes,
      language,
    }),
  });

  const payload = (await response.json()) as GeneratedPayload & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || copy.generateErrorPrefix + " " + copy.lessonLabel + " " + lessonId + ".");
  }

  if (!isGeneratedLesson(payload.lesson)) {
    throw new Error(copy.invalidGeneratedPrefix + " " + copy.lessonLabel + " " + lessonId + ".");
  }

  return {
    ...payload,
    lesson: normalizeLessonContent(payload.lesson),
  } as Required<Pick<GeneratedPayload, "lesson">> & GeneratedPayload;
}

async function validateGeneratedLesson(
  lesson: LessonContent,
  questions: StudyQuestion[],
  pages: SourcePageInput[],
  copy: ImportCopy,
  language: LanguageProfile,
) {
  const response = await fetch("/api/ingest/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lesson,
      questions,
      pages,
      language,
    }),
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
  const [targetLanguageCode, setTargetLanguageCode] = useState(
    ingestionConfig.autoImport.targetLanguage,
  );
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
  const [ocrSkipped, setOcrSkipped] = useState(false);
  const [handoffNote, setHandoffNote] = useState("");
  const [mcpJobId, setMcpJobId] = useState("");
  const [mcpStatus, setMcpStatus] = useState<
    ImportJobStatus | "idle" | "syncing"
  >("idle");
  const [mcpSyncProgress, setMcpSyncProgress] = useState(0);
  const [bridgeSetup, setBridgeSetup] = useState<{
    configured: boolean;
    activeSubscriptions: number;
    nextRefreshBefore: string | null;
  } | null>(null);
  const mcpRunRef = useRef(0);

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

    void fetch("/api/mcp-bridge/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBridgeSetup(data);
      })
      .catch(() => {
        if (!cancelled) {
          setBridgeSetup({
            configured: false,
            activeSubscriptions: 0,
            nextRefreshBefore: null,
          });
        }
      });

    void fetch("/api/import-jobs")
      .then((res) => res.json())
      .then((data: { jobs?: Array<{ id: string; status: ImportJobStatus }> }) => {
        if (cancelled) return;
        const latestJob = data.jobs?.[0];
        if (latestJob) {
          setMcpJobId(latestJob.id);
          setMcpStatus(latestJob.status);
        }
      })
      .catch(() => undefined);

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

  async function analyzeFiles(sourceFiles: File[] = files) {
    if (!sourceFiles.length) return;

    const runId = mcpRunRef.current + 1;
    mcpRunRef.current = runId;
    setFiles(sourceFiles);
    setMcpJobId("");
    setMcpStatus("idle");
    setMcpSyncProgress(0);
    setHandoffNote("");
    setError("");
    setStatus("extracting");
    setProgress(0);
    setMessage(copy.extracting);

    const language = getLanguageProfile(
      targetLanguageCode || ingestionConfig.autoImport.targetLanguage,
      ingestionConfig.autoImport.learnerLanguage,
    );
    let nextCourseTitle =
      sourceFiles[0]?.name.replace(/\.pdf$/i, "") || copy.genericCourseTitle;
    let nextLevel = level.trim() || language.targetName;
    let nextEdition = edition.trim();

    try {
      const nextDocuments: ExtractedDocument[] = [];
      const nextMaps: DocumentMap[] = [];

      setOcrUsed(false);
      setOcrSkipped(false);

      for (let index = 0; index < sourceFiles.length; index += 1) {
        let document = await extractPdf(sourceFiles[index], index);

        if (lowTextRatio(document) >= ingestionConfig.pdf.ocrTriggerRatio) {
          if (aiStatus?.configured) {
            setOcrUsed(true);
            setMessage(
              copy.ocrPrefix + " " + fileLabel(sourceFiles[index].name) + "…",
            );

            document = await ocrLowTextPages(
              sourceFiles[index],
              document,
              (completed, total) => {
                const fileBase = index / sourceFiles.length;
                const fileShare = 1 / sourceFiles.length;
                const ocrShare = total ? completed / total : 0;
                setProgress(
                  Math.round((fileBase + fileShare * ocrShare * 0.4) * 55),
                );
              },
            );
          } else {
            setOcrSkipped(true);
          }
        }

        nextDocuments.push(document);

        setProgress(
          Math.round(((index + 0.45) / sourceFiles.length) * 45),
        );
        setMessage(
          copy.mappingPrefix + " " + fileLabel(sourceFiles[index].name) + "…",
        );

        const localStarts = localLessonStarts(document);
        const aiStarts =
          aiStatus?.configured &&
          document.pages.some((page) => page.text.length > 30)
            ? await aiMapDocument(document, copy, language)
            : [];
        const starts = aiStarts.length ? aiStarts : localStarts;

        nextMaps.push({
          documentId: document.id,
          fileName: document.fileName,
          starts: dedupeStarts(starts),
        });

        if (index === 0) {
          if (aiStatus?.configured) {
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
                language,
              }),
            });

            const metadata = (await metadataResponse.json()) as {
              title?: string;
              level?: string;
              edition?: string;
            };

            if (metadataResponse.ok) {
              if (metadata.title?.trim()) nextCourseTitle = metadata.title.trim();
              if (metadata.level?.trim()) nextLevel = metadata.level.trim();
              if (metadata.edition?.trim()) nextEdition = metadata.edition.trim();
            }
          }

          setCourseTitle(nextCourseTitle);
          setLevel(nextLevel);
          setEdition(nextEdition);
        }

        setProgress(Math.round(((index + 1) / sourceFiles.length) * 55));
      }

      setDocuments(nextDocuments);
      setMaps(nextMaps);
      setProgress(60);
      setMessage(copy.autoQueued);
      setStatus("mapped");

      await syncImportToMcp(
        nextDocuments,
        nextMaps,
        sourceFiles,
        runId,
        {
          title: nextCourseTitle,
          level: nextLevel,
          edition: nextEdition || undefined,
        },
      );
    } catch (reason) {
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : copy.analyzeError);
    }
  }

  async function createCurrentHandoff(context?: {
    files: File[];
    documents: ExtractedDocument[];
    maps: DocumentMap[];
  }) {
    const sourceFiles = context?.files ?? files;
    const sourceDocuments = context?.documents ?? documents;
    const sourceMaps = context?.maps ?? maps;

    if (!sourceFiles.length || !sourceDocuments.length) return null;

    return buildHandoffPackage({
      files: sourceFiles,
      documents: sourceDocuments,
      maps: sourceMaps,
      courseHint: {
        title: courseTitle,
        level,
        edition: edition || undefined,
      },
      language: getLanguageProfile(targetLanguageCode || "ko"),
    });
  }

  async function syncImportToMcp(
    sourceDocuments: ExtractedDocument[],
    sourceMaps: DocumentMap[],
    sourceFiles: File[],
    runId: number,
    courseHint: {
      title: string;
      level: string;
      edition?: string;
    },
  ) {
    setMcpStatus("syncing");
    setMcpSyncProgress(0);

    try {
      const job = await queueMcpImportJob({
        files: sourceFiles,
        documents: sourceDocuments,
        maps: sourceMaps,
        courseHint,
        language: getLanguageProfile(
          targetLanguageCode || ingestionConfig.autoImport.targetLanguage,
          ingestionConfig.autoImport.learnerLanguage,
        ),
        onProgress(uploaded, total) {
          if (mcpRunRef.current !== runId) return;
          const percent = total ? Math.round((uploaded / total) * 100) : 0;
          setMcpSyncProgress(percent);
          setProgress(60 + Math.round(percent * 0.15));
        },
      });

      if (mcpRunRef.current !== runId) return;

      setMcpJobId(job.id);
      setMcpStatus(job.status);
      setProgress(75);
      setMessage(copy.mcpWaiting);
      setHandoffNote(copy.mcpQueued);

      await monitorMcpJob(
        job.id,
        {
          files: sourceFiles,
          documents: sourceDocuments,
          maps: sourceMaps,
        },
        runId,
      );
    } catch (reason) {
      if (mcpRunRef.current !== runId) return;
      setMcpStatus("failed");
      setHandoffNote(
        copy.mcpSyncFailed +
          (reason instanceof Error ? " " + reason.message : ""),
      );
    }
  }

  async function monitorMcpJob(
    jobId: string,
    context: {
      files: File[];
      documents: ExtractedDocument[];
      maps: DocumentMap[];
    },
    runId: number,
  ) {
    while (mcpRunRef.current === runId) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      if (mcpRunRef.current !== runId) return;

      try {
        let job = await getMcpImportJob(jobId);

        if (
          job.status === "processing" &&
          Date.now() - new Date(job.updatedAt).getTime() >
            ingestionConfig.autoImport.staleJobMinutes * 60 * 1000
        ) {
          job = await requeueMcpImportJob(jobId);
          setHandoffNote(copy.mcpAutoRequeued);
        }

        setMcpStatus(job.status);
        if (job.status === "queued") {
          setProgress(75);
          setMessage(copy.mcpWaiting);
        } else if (job.status === "processing") {
          setProgress(84);
          setMessage(copy.mcpProcessing);
        } else if (job.status === "ready") {
          setProgress(95);
          setMessage(copy.mcpReady);
        }

        if (job.status === "failed") {
          setError(
            copy.mcpJobFailed +
              (job.error ? " " + job.error : ""),
          );
          return;
        }

        if (job.status === "ready" && job.resultBundle) {
          const consumeResult = await consumeMcpImportJob(jobId);
          if (consumeResult.course) {
            resetForCourse();
            replaceCourse(consumeResult.course);
          } else {
            const bundleFile = new File(
              [JSON.stringify(job.resultBundle)],
              "haneul-mcp-result.json",
              { type: "application/json" },
            );
            await importChatGptBundle(bundleFile, context);
          }

          if (mcpRunRef.current === runId) {
            setMcpStatus("consumed");
            setStatus("done");
            setProgress(100);
            setMessage(copy.autoComplete);
            setHandoffNote(copy.mcpImported);
          }
          return;
        }

        if (job.status === "consumed") return;
      } catch (reason) {
        if (mcpRunRef.current !== runId) return;
        setHandoffNote(
          copy.mcpPollingError +
            (reason instanceof Error ? " " + reason.message : ""),
        );
        return;
      }
    }
  }

  async function exportChatGptHandoff() {
    const handoff = await createCurrentHandoff();
    if (!handoff) return;

    downloadJsonFile(handoffFileName(courseTitle), handoff);
    setHandoffNote(copy.handoffReady);
  }

  async function copyChatGptPrompt() {
    const handoff = await createCurrentHandoff();
    if (!handoff) return;

    await navigator.clipboard.writeText(
      buildChatGptPrompt(handoff),
    );
    setHandoffNote(copy.promptCopied);
  }

  async function shareToChatGpt() {
    const handoff = await createCurrentHandoff();
    if (!handoff) return;

    const handoffFile = new File(
      [JSON.stringify(handoff, null, 2)],
      handoffFileName(courseTitle),
      { type: "application/json" },
    );
    const shareFiles = [...files, handoffFile];
    const shareData = {
      title: "Haneul ChatGPT Handoff",
      text: buildChatGptPrompt(handoff),
      files: shareFiles,
    };

    if (
      typeof navigator.share !== "function" ||
      (typeof navigator.canShare === "function" &&
        !navigator.canShare({ files: shareFiles }))
    ) {
      setHandoffNote(copy.shareUnsupported);
      return;
    }

    try {
      await navigator.share(shareData);
      setHandoffNote(copy.shareOpened);
    } catch (reason) {
      if (
        reason instanceof DOMException &&
        reason.name === "AbortError"
      ) {
        return;
      }

      setHandoffNote(copy.shareUnsupported);
    }
  }

  function pageNumbersFromLesson(lesson: LessonContent) {
    const pageNumbers = new Set<number>();
    const serialized = JSON.stringify(lesson);
    const pattern = /p\.?\s*(\d+)(?:\s*[–-]\s*(\d+))?/gi;

    for (const match of serialized.matchAll(pattern)) {
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

      const safeEnd = Math.min(end, start + 60);
      for (let page = start; page <= safeEnd; page += 1) {
        pageNumbers.add(page);
      }
    }

    return pageNumbers;
  }

  function localPagesForBundleLesson(
    lesson: LessonContent,
    sourceDocuments: ExtractedDocument[] = documents,
    sourceMaps: DocumentMap[] = maps,
  ) {
    const mapped = sourceDocuments.flatMap((document) => {
      const map = sourceMaps.find((item) => item.documentId === document.id);
      if (!map?.starts.some((item) => item.lessonId === lesson.id)) {
        return [];
      }

      return pagesForLesson(document, map.starts, lesson.id);
    });

    if (mapped.length) return mapped;

    const referencedPages = pageNumbersFromLesson(lesson);
    if (!referencedPages.size) return [];

    return sourceDocuments.flatMap((document) =>
      document.pages.filter((page) =>
        referencedPages.has(page.pageNumber),
      ),
    );
  }

  async function importChatGptBundle(
    file: File,
    context?: {
      files: File[];
      documents: ExtractedDocument[];
      maps: DocumentMap[];
    },
  ) {
    const sourceFiles = context?.files ?? files;
    const sourceDocuments = context?.documents ?? documents;
    const sourceMaps = context?.maps ?? maps;

    if (!sourceDocuments.length) {
      setError(copy.bundleRequiresPdf);
      return;
    }

    setError("");

    try {
      const bundle = parseCourseBundle(await file.text());

      const handoff = await createCurrentHandoff({
        files: sourceFiles,
        documents: sourceDocuments,
        maps: sourceMaps,
      });
      if (!handoff) {
        throw new Error(copy.bundleRequiresPdf);
      }

      const verification = verifyBundleSource(bundle, handoff);

      if (verification.status === "mismatch") {
        throw new Error(copy.bundleMismatch);
      }

      setHandoffNote(
        verification.status === "verified"
          ? copy.bundleSourceVerified
          : copy.bundleSourceUnverified,
      );

      const lessons = bundle.course.lessons
        .map((lesson) => {
          const localMedia = buildLessonMedia(
            localPagesForBundleLesson(
              lesson,
              sourceDocuments,
              sourceMaps,
            ),
          );
          const existingMedia = lesson.media ?? [];
          const byId = new Map(
            [...existingMedia, ...localMedia].map((item) => [
              item.id,
              item,
            ]),
          );

          return {
            ...lesson,
            media: [...byId.values()],
          };
        })
        .sort((a, b) => a.id - b.id);

      const runtimeCourse: RuntimeCourse = {
        id: "chatgpt-imported-" + Date.now(),
        language: bundle.language ?? defaultLanguageProfile,
        title:
          bundle.course.title.trim() ||
          courseTitle.trim() ||
          copy.genericCourseTitle,
        level:
          bundle.course.level.trim() ||
          level.trim() ||
          copy.genericLevel,
        source: {
          fileName: sourceFiles[0]?.name,
          fileNames: sourceFiles.map((item) => item.name),
          importedAt: new Date().toISOString(),
          pageCount: sourceDocuments.reduce(
            (sum, document) => sum + document.pageCount,
            0,
          ),
          edition:
            bundle.course.edition ||
            edition ||
            undefined,
          coverImageDataUrl:
            sourceDocuments[0]?.pages[0]?.previewImageDataUrl,
        },
        lessons,
        questions: bundle.course.questions,
      };

      setCourseTitle(runtimeCourse.title);
      setLevel(runtimeCourse.level);
      setEdition(bundle.course.edition ?? edition);
      resetForCourse();
      replaceCourse(runtimeCourse);
      setStatus("done");
      setProgress(100);

      const mediaCount = lessons.reduce(
        (sum, lesson) => sum + (lesson.media?.length ?? 0),
        0,
      );

      setMessage(
        copy.bundleImported +
          " " +
          lessons.length +
          " " +
          copy.importedLessons +
          " · " +
          runtimeCourse.questions.length +
          " " +
          copy.importedQuestions +
          " · " +
          mediaCount +
          " " +
          copy.importedMedia +
          ".",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : copy.invalidBundle,
      );
    }
  }

  async function generateCourse() {
    if (
      !documents.length ||
      !lessonIds.length ||
      !aiStatus?.configured
    ) {
      return;
    }

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

        const language = getLanguageProfile(
          targetLanguageCode || "ko",
        );
        let payload = await requestGeneratedLesson(
          lessonId,
          sourcePages,
          copy,
          language,
        );
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
          language,
        );

        if (!validation.pass) {
          const revisionNotes = [
            ...validation.issues.map((item) => copy.revisionIssue + " " + item),
            ...validation.missingTopics.map((item) => copy.revisionMissing + " " + item),
          ];

          setMessage(copy.lessonLabel + " " + lessonId + " " + copy.repairPrefix);
          payload = await requestGeneratedLesson(
            lessonId,
            sourcePages,
            copy,
            language,
            revisionNotes,
          );
          lessonQuestions = (payload.questions ?? []).map((question) => ({
            ...question,
            lessonId,
          }));

          validation = await validateGeneratedLesson(
            { ...payload.lesson, id: lessonId },
            lessonQuestions,
            sourcePages,
            copy,
            language,
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
        language: getLanguageProfile(targetLanguageCode || "ko"),
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
          <h1>{copy.autoTitle}</h1>
          <p>{copy.autoIntro}</p>
        </div>
        <div className="ingest-hero-side">
          <div className="ingest-orb"><WandSparkles size={42} /></div>
          <span
            className={
              bridgeSetup?.configured
                ? "ai-ready-badge ready"
                : "ai-ready-badge"
            }
          >
            {bridgeSetup?.configured
              ? copy.bridgeReady
              : bridgeSetup
                ? copy.bridgeNeedsSetup
                : copy.bridgeChecking}
          </span>
        </div>
      </section>

      <section className="ingest-run-card assisted-import-card">
        <div className="ingest-run-copy">
          <span className="eyebrow">{copy.autoStep}</span>
          <h2>{copy.choosePdf}</h2>
          <p>{copy.autoDropHint}</p>

          <label className="pdf-dropzone">
            {status === "extracting" || mcpStatus === "syncing" ? (
              <LoaderCircle className="spin" size={32} />
            ) : (
              <UploadCloud size={32} />
            )}
            <strong>
              {files.length ? copy.replacePdf : copy.choosePdf}
            </strong>
            <span>{copy.autoPrimaryHint}</span>
            <input
              accept="application/pdf,.pdf"
              multiple
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setFiles(selected);
                setDocuments([]);
                setMaps([]);
                mcpRunRef.current += 1;
                setMcpJobId("");
                setMcpStatus("idle");
                setMcpSyncProgress(0);
                setStatus("idle");
                setProgress(0);
                setMessage("");
                setError("");
                setHandoffNote("");

                if (
                  selected.length &&
                  ingestionConfig.autoImport.autoStartOnFileSelection
                ) {
                  void analyzeFiles(selected);
                }
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
                    <span>
                      {index === 0 ? copy.primary : copy.supplement}
                      {" · "}
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <span className="file-order">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {files.length || mcpStatus !== "idle" ? (
            <div className="ingest-progress-wrap">
              <div className="ingest-progress">
                <span style={{ width: progress + "%" }} />
              </div>
              <div className="ingest-progress-label">
                <span>
                  {message ||
                    (mcpStatus === "syncing"
                      ? copy.mcpSyncing + " " + mcpSyncProgress + "%"
                      : copy.autoPreparing)}
                </span>
                <strong>{progress}%</strong>
              </div>
            </div>
          ) : null}

          <div className="auto-import-steps">
            <div
              className={
                files.length ? "auto-import-step done" : "auto-import-step"
              }
            >
              <span>1</span>
              <div>
                <strong>{copy.autoStagePdf}</strong>
                <small>{copy.autoStagePdfNote}</small>
              </div>
            </div>
            <div
              className={
                documents.length || mcpStatus !== "idle"
                  ? "auto-import-step done"
                  : "auto-import-step"
              }
            >
              <span>2</span>
              <div>
                <strong>{copy.autoStageSource}</strong>
                <small>{copy.autoStageSourceNote}</small>
              </div>
            </div>
            <div
              className={
                mcpStatus === "processing" ||
                mcpStatus === "ready" ||
                mcpStatus === "consumed"
                  ? "auto-import-step done"
                  : mcpStatus === "queued"
                    ? "auto-import-step active"
                    : "auto-import-step"
              }
            >
              <span>3</span>
              <div>
                <strong>{copy.autoStageCompile}</strong>
                <small>
                  {mcpStatus === "queued"
                    ? copy.mcpWaiting
                    : mcpStatus === "processing"
                      ? copy.mcpProcessing
                      : copy.autoStageCompileNote}
                </small>
              </div>
            </div>
            <div
              className={
                mcpStatus === "consumed"
                  ? "auto-import-step done"
                  : mcpStatus === "ready"
                    ? "auto-import-step active"
                    : "auto-import-step"
              }
            >
              <span>4</span>
              <div>
                <strong>{copy.autoStageReady}</strong>
                <small>{copy.autoStageReadyNote}</small>
              </div>
            </div>
          </div>

          {bridgeSetup && !bridgeSetup.configured ? (
            <div className="ingest-warning">
              <strong>{copy.bridgeNeedsSetup}</strong>
              <span>{copy.bridgeSetupOnce}</span>
            </div>
          ) : null}

          {ocrUsed ? (
            <div className="ingest-warning">{copy.ocrUsed}</div>
          ) : ocrSkipped ? (
            <div className="ingest-warning">{copy.ocrSkippedBridge}</div>
          ) : likelyScanned ? (
            <div className="ingest-warning">{copy.lowText}</div>
          ) : null}

          {error ? (
            <div className="ingest-error">
              <span>{error}</span>
              {files.length ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void analyzeFiles(files)}
                >
                  <Sparkles size={16} />
                  {copy.retryAutoImport}
                </button>
              ) : null}
            </div>
          ) : null}

          {status === "done" || mcpStatus === "consumed" ? (
            <div className="ingest-success">
              <CheckCircle2 size={24} />
              <div>
                <strong>{copy.successTitle}</strong>
                <span>{message || copy.autoComplete}</span>
              </div>
              <Link className="primary-button" href="/learn">
                {copy.openCourse} <ArrowRight size={17} />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <details className="ingest-advanced">
        <summary>{copy.advancedOptions}</summary>
        <div className="ingest-grid">
          <article className="ingest-panel">
            <div className="ingest-panel-title">
              <span>A</span>
              <div>
                <strong>{copy.courseMetadata}</strong>
                <small>{copy.autoDetectedEditable}</small>
              </div>
            </div>

            <div className="ingest-fields">
              <label>
                <span>{copy.targetLanguage}</span>
                <input
                  list="haneul-language-codes"
                  placeholder={copy.targetLanguageHint}
                  value={targetLanguageCode}
                  onChange={(event) =>
                    setTargetLanguageCode(
                      event.target.value.trim().toLowerCase(),
                    )
                  }
                />
                <datalist id="haneul-language-codes">
                  <option value="ko">Tiếng Hàn</option>
                  <option value="en">Tiếng Anh</option>
                  <option value="zh">Tiếng Trung</option>
                  <option value="ja">Tiếng Nhật</option>
                  <option value="fr">Tiếng Pháp</option>
                </datalist>
              </label>
              <label>
                <span>{copy.courseName}</span>
                <input
                  value={courseTitle}
                  onChange={(event) => setCourseTitle(event.target.value)}
                />
              </label>
              <label>
                <span>{copy.level}</span>
                <input
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                />
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
            ) : null}

            {lessonIds.length ? (
              <div className="detected-lessons">
                {primaryMap.starts.map((item, index) => {
                  const next = primaryMap.starts[index + 1];
                  return (
                    <div key={item.lessonId}>
                      <span>{copy.lessonLabel} {item.lessonId}</span>
                      <strong>
                        p.{item.pageNumber}
                        {next ? "–" + (next.pageNumber - 1) : "+"}
                      </strong>
                      <small>{item.titleHint || copy.detectedTitle}</small>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>

          <article className="ingest-panel">
            <div className="ingest-panel-title">
              <span>B</span>
              <div>
                <strong>{copy.fallbackTools}</strong>
                <small>{copy.fallbackToolsHint}</small>
              </div>
            </div>

            {documents.length ? (
              <div className="handoff-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void exportChatGptHandoff()}
                >
                  <Download size={16} />
                  {copy.exportHandoff}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void copyChatGptPrompt()}
                >
                  <Copy size={16} />
                  {copy.copyPrompt}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void shareToChatGpt()}
                >
                  <UploadCloud size={16} />
                  {copy.shareToChatGpt}
                </button>
              </div>
            ) : null}

            <label
              className={
                "secondary-button bundle-file-button" +
                (!documents.length ? " disabled" : "")
              }
            >
              <FileText size={18} />
              {copy.chooseBundle}
              <input
                accept="application/json,.json"
                disabled={!documents.length}
                type="file"
                onChange={(event) => {
                  const bundleFile = event.target.files?.[0];
                  if (bundleFile) {
                    void importChatGptBundle(bundleFile);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>

            {aiStatus?.configured ? (
              <button
                className="secondary-button"
                disabled={
                  status !== "mapped" ||
                  !lessonIds.length
                }
                onClick={generateCourse}
                type="button"
              >
                {status === "generating" ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <WandSparkles size={18} />
                )}
                {copy.generateDirectFallback}
              </button>
            ) : null}

            {mcpJobId ? (
              <div className="mcp-bridge-status">
                <strong>{copy.mcpBridge}</strong>
                <span>{mcpJobId}</span>
              </div>
            ) : null}

            {handoffNote ? (
              <div className="handoff-note">{handoffNote}</div>
            ) : null}
          </article>
        </div>
      </details>
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
