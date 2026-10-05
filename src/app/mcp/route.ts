import {
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  claimImportJob,
  failImportJob,
  getImportJob,
  listImportJobs,
  readImportPages,
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
            "Keep the compiler language-neutral. The job.language target may be Korean, English, Chinese or another future profile.",
          ],
          runtimeCompatibility: {
            note:
              "Haneul runtime v1 was originally Korean-first. Existing field names such as vocabulary.ko and vocabulary.vi are legacy storage keys: ko currently means target-language text and vi means learner-language meaning. The MCP bridge itself is language-neutral and a generic runtime schema can replace these aliases later without changing the job protocol.",
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

export async function GET(request: Request) {
  return handler.fetch(request);
}

export async function POST(request: Request) {
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  return handler.fetch(request);
}
