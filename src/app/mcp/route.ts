import {
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  claimImportJob,
  failImportJob,
  finalizeCourseFromDrafts,
  getCompilationProgress,
  getImportJob,
  listImportJobs,
  readImportPages,
  requeueImportJob,
  saveLessonDraft,
  submitImportBundle,
} from "@/lib/import-job-store";
import {
  parseCourseBundle,
  type CompiledCourseBundle,
} from "@/lib/course-bundle";
import type {
  ImportJob,
  ImportJobStatus,
} from "@/lib/import-jobs";
import { handleMcpEventRpc } from "@/lib/mcp-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobStatusSchema = z.enum([
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
  "consumed",
]);

function withoutResult(job: ImportJob) {
  const summary: Partial<ImportJob> = { ...job };
  delete summary.resultBundle;
  return summary;
}

function sameSourceManifest(
  job: ImportJob,
  bundle: CompiledCourseBundle,
) {
  const received = bundle.sourceManifest ?? [];
  if (received.length !== job.sourceManifest.length) return false;

  const byName = new Map(received.map((item) => [item.name, item]));

  return job.sourceManifest.every((expected) => {
    const actual = byName.get(expected.name);
    return Boolean(
      actual &&
        actual.sha256 === expected.sha256 &&
        actual.size === expected.size &&
        actual.pageCount === expected.pageCount &&
        actual.lastModified === expected.lastModified,
    );
  });
}

function imageContent(dataUrl: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  return {
    type: "image" as const,
    data: match[2],
    mimeType: match[1],
  };
}

function toolFailure(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text:
          error instanceof Error
            ? error.message
            : "MCP tool thất bại.",
      },
    ],
  };
}

function buildMcpServer() {
  const server = new McpServer({
    name: "haneul-learning-bridge",
    version: "0.2.0",
  });

  server.registerTool(
    "list_import_jobs",
    {
      description:
        "List Haneul textbook import jobs. Use this to find queued books waiting for AI compilation.",
      inputSchema: z.object({
        status: jobStatusSchema.optional(),
      }),
    },
    async ({ status }) => {
      try {
        const jobs = await listImportJobs(
          status as ImportJobStatus | undefined,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                jobs.map((job) => withoutResult(job)),
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "get_import_job",
    {
      description:
        "Read one Haneul import job: language profile, textbook fingerprints, lesson map and upload completeness.",
      inputSchema: z.object({
        jobId: z.string().min(8),
      }),
    },
    async ({ jobId }) => {
      try {
        const job = await getImportJob(jobId);
        if (!job) throw new Error("Không tìm thấy import job.");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(withoutResult(job), null, 2),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "claim_import_job",
    {
      description:
        "Mark a queued Haneul import job as processing before compiling its curriculum.",
      inputSchema: z.object({
        jobId: z.string().min(8),
      }),
    },
    async ({ jobId }) => {
      try {
        const job = await claimImportJob(jobId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(withoutResult(job), null, 2),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );


  server.registerTool(
    "requeue_import_job",
    {
      description:
        "Return a stuck or interrupted processing/failed Haneul import job to queued so another ChatGPT run can pick it up. This re-emits import_job.queued.",
      inputSchema: z.object({
        jobId: z.string().min(8),
      }),
    },
    async ({ jobId }) => {
      try {
        const job = await requeueImportJob(jobId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(withoutResult(job), null, 2),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
  server.registerTool(
    "read_import_pages",
    {
      description:
        "Read extracted textbook pages from a Haneul import job. Returns page text and, when requested, full-page preview images for scanned/visual pages. Read the source in chunks and preserve page references.",
      inputSchema: z.object({
        jobId: z.string().min(8),
        fileName: z.string().min(1),
        startPage: z.number().int().min(1),
        endPage: z.number().int().min(1).optional(),
        includeImages: z.boolean().optional().default(false),
        maxImages: z.number().int().min(1).max(6).optional().default(4),
      }),
    },
    async ({
      jobId,
      fileName,
      startPage,
      endPage,
      includeImages,
      maxImages,
    }) => {
      try {
        const safeEnd = Math.min(
          endPage ?? startPage + 7,
          startPage + 19,
        );
        const pages = await readImportPages({
          jobId,
          fileName,
          startPage,
          endPage: safeEnd,
          limit: 20,
        });

        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];
        let images = 0;

        for (const page of pages) {
          content.push({
            type: "text",
            text:
              "[SOURCE: " +
              page.fileName +
              " · p." +
              page.pageNumber +
              "]\n" +
              (page.text || "(no extractable text)") +
              (page.externalLinks?.length
                ? "\nLinks: " + page.externalLinks.join(", ")
                : ""),
          });

          if (
            includeImages &&
            images < maxImages &&
            page.previewImageDataUrl
          ) {
            const image = imageContent(page.previewImageDataUrl);
            if (image) {
              content.push({
                type: "text",
                text:
                  "[PAGE IMAGE: " +
                  page.fileName +
                  " · p." +
                  page.pageNumber +
                  "]",
              });
              content.push(image);
              images += 1;
            }
          }
        }

        if (!content.length) {
          content.push({
            type: "text",
            text: "Không có trang nào trong khoảng yêu cầu.",
          });
        }

        return { content };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "get_compilation_progress",
    {
      description:
        "Read persistent lesson-level compilation checkpoints for a Haneul import job. Use this before reading source pages so interrupted runs resume from unfinished lessons instead of restarting.",
      inputSchema: z.object({
        jobId: z.string().min(8),
      }),
    },
    async ({ jobId }) => {
      try {
        const progress = await getCompilationProgress(jobId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(progress, null, 2),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "save_lesson_draft",
    {
      description:
        "Persist one fully compiled lesson and its questions as an idempotent checkpoint. Calling again with the same lessonId replaces only that lesson draft, so future runs can resume without recompiling completed lessons.",
      inputSchema: z.object({
        jobId: z.string().min(8),
        lesson: z.record(z.string(), z.unknown()),
        questions: z
          .array(z.record(z.string(), z.unknown()))
          .optional()
          .default([]),
      }),
    },
    async ({ jobId, lesson, questions }) => {
      try {
        const draft = await saveLessonDraft(
          jobId,
          lesson as never,
          questions as never,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  lessonId: draft.lessonId,
                  title: draft.lesson.title,
                  savedAt: draft.savedAt,
                  questionCount: draft.questions.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "finalize_course_bundle",
    {
      description:
        "Assemble the final Haneul Course Bundle server-side from saved lesson checkpoints. Use only after get_compilation_progress confirms all textbook lessons have verified drafts. This avoids resending the full course and preserves completed work across interruptions.",
      inputSchema: z.object({
        jobId: z.string().min(8),
        lessonIds: z.array(z.number().int().min(1)).optional(),
        title: z.string().optional(),
        level: z.string().optional(),
        edition: z.string().optional(),
      }),
    },
    async ({ jobId, lessonIds, title, level, edition }) => {
      try {
        const saved = await finalizeCourseFromDrafts(jobId, {
          lessonIds,
          title,
          level,
          edition,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  jobId: saved.id,
                  status: saved.status,
                  lessons: saved.resultBundle?.course.lessons.length ?? 0,
                  questions: saved.resultBundle?.course.questions.length ?? 0,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "get_compilation_contract",
    {
      description:
        "Return the language-neutral Haneul compilation rules and current runtime bundle contract. Call before submitting a compiled course.",
      inputSchema: z.object({
        jobId: z.string().min(8),
      }),
    },
    async ({ jobId }) => {
      try {
        const job = await getImportJob(jobId);
        if (!job) throw new Error("Không tìm thấy import job.");

        const contract = {
          output: {
            format: "haneul-course-bundle",
            version: 1,
            sourceManifest:
              "Copy exactly from job.sourceManifest.",
          },
          language: job.language,
          principles: [
            "The uploaded textbook is the curriculum source of truth.",
            "Preserve lesson order and source page references.",
            "Cover vocabulary, grammar, dialogue, pronunciation, culture, notes, exercises and special sections when present.",
            "Create practice for vocabulary, grammar, listening, speaking, reading and writing without introducing unsupported curriculum.",
            "Derived exercises must be grounded only in knowledge from the same lesson and mark sourceRef as Derived from <source pages>.",
            "Do not invent unreadable source content; record uncertainty instead.",
            "Keep the compiler language-neutral. Use job.language instead of assuming Korean, Vietnamese, English, or Chinese.",
            "For vocabulary prefer targetText and learnerMeaning. For dialogue lines prefer targetText and learnerMeaning. Legacy ko/vi aliases are accepted and normalized automatically.",
            "After finishing and checking each lesson, call save_lesson_draft immediately. Never keep many completed lessons only in chat context.",
            "Before source reading in any new or resumed run, call get_compilation_progress and skip lessonIds already checkpointed unless they need deliberate correction.",
            "Use finalize_course_bundle after all real textbook lessons are checkpointed. Detected lesson candidates are hints and may contain false positives.",
          ],
          checkpointWorkflow: [
            "get_compilation_progress",
            "read_import_pages for one lesson",
            "compile and QA that lesson",
            "save_lesson_draft",
            "repeat only for unfinished lessons",
            "finalize_course_bundle",
          ],
          runtimeCompatibility: {
            note:
              "Runtime v1 still exposes legacy aliases such as vocabulary.ko and vocabulary.vi to older UI components. Bundle parsing now normalizes canonical targetText/learnerMeaning and targetTitle/learnerTitle into those aliases, so new language profiles do not require changing the MCP protocol.",
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(contract, null, 2),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "submit_course_bundle",
    {
      description:
        "Submit the complete compiled Haneul Course Bundle for an import job. The server validates bundle shape and exact PDF fingerprints before making it available to the browser.",
      inputSchema: z.object({
        jobId: z.string().min(8),
        bundle: z.record(z.string(), z.unknown()),
      }),
    },
    async ({ jobId, bundle }) => {
      try {
        const job = await getImportJob(jobId);
        if (!job) throw new Error("Không tìm thấy import job.");

        const parsed = parseCourseBundle(JSON.stringify(bundle));
        if (!sameSourceManifest(job, parsed)) {
          throw new Error(
            "sourceManifest của bundle không khớp bộ PDF trong import job.",
          );
        }

        if (
          parsed.language &&
          (parsed.language.target !== job.language.target ||
            parsed.language.learner !== job.language.learner)
        ) {
          throw new Error(
            "Language profile của bundle không khớp import job.",
          );
        }

        const normalizedBundle: CompiledCourseBundle = {
          ...parsed,
          language: parsed.language ?? job.language,
        };

        const saved = await submitImportBundle(
          jobId,
          normalizedBundle,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  jobId: saved.id,
                  status: saved.status,
                  lessons: parsed.course.lessons.length,
                  questions: parsed.course.questions.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "fail_import_job",
    {
      description:
        "Record a blocking source/compilation problem on a Haneul import job instead of inventing content.",
      inputSchema: z.object({
        jobId: z.string().min(8),
        error: z.string().min(1).max(4000),
      }),
    },
    async ({ jobId, error }) => {
      try {
        const job = await failImportJob(jobId, error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  jobId: job.id,
                  status: job.status,
                  error: job.error,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (reason) {
        return toolFailure(reason);
      }
    },
  );

  return server;
}

const handler = createMcpHandler(buildMcpServer);

function authorizeMcp(request: Request) {
  const token = process.env.HANEUL_MCP_TOKEN?.trim();

  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === "Bearer " + token;
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      error:
        "MCP endpoint chưa được cấp quyền. Cấu hình HANEUL_MCP_TOKEN và gửi Bearer token.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    },
  );
}

async function handleMcp(request: Request) {
  if (!authorizeMcp(request)) return unauthorizedResponse();

  const eventResponse = await handleMcpEventRpc(request);
  if (eventResponse) return eventResponse;

  return handler.fetch(request);
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
