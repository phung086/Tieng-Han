import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import type { McpReceipt } from "@/lib/import-monitor";

const MAX_LOG_BYTES = 1_048_576;
const MAX_BODY_BYTES = 1_048_576;
const tools = new Set([
  "list_import_jobs", "prepare_import_job", "get_import_job", "claim_import_job",
  "requeue_import_job", "read_import_pages", "get_compilation_progress", "save_work_checkpoint",
  "save_lesson_draft", "finalize_course_bundle", "get_compilation_contract", "submit_course_bundle", "fail_import_job",
]);
const methods = new Set(["initialize", "notifications/initialized", "ping", "tools/list", "tools/call", "server/discover", "events/list", "events/subscribe", "events/unsubscribe"]);
const root = () => process.env.HANEUL_IMPORT_MONITOR_DIR || path.join(process.cwd(), ".haneul", "import-monitor");
const logFile = () => path.join(root(), "requests.jsonl");
let writing = Promise.resolve();
// Undici associates a clone finalizer with the original tee branch. Keep the
// clone alive for the original request's lifetime so GC cannot cancel the body
// while the compiler is about to read it. Weak keys release both with the request.
const observationClones = new WeakMap<Request, Request>();

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function page(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 10000 ? value : undefined;
}

// Allowlist metadata only: never persist headers, callback URLs/secrets, RPC IDs,
// source text/images, model answers, or arbitrary arguments.
export function describeMcpReceipt(value: unknown, at: string): McpReceipt {
  const rpc = object(value);
  const params = object(rpc.params);
  const args = object(params.arguments);
  const cursor = object(args.sourceCursor);
  const method = typeof rpc.method === "string" && methods.has(rpc.method) ? rpc.method : "unknown";
  const tool = method === "tools/call" ? typeof params.name === "string" && tools.has(params.name) ? params.name : "unknown" : undefined;
  return {
    id: randomUUID(), at, method, tool,
    jobId: tool && typeof args.jobId === "string" && /^import-[a-z0-9-]{8,72}$/i.test(args.jobId) ? args.jobId : undefined,
    lessonId: tool ? page(args.lessonId) : undefined,
    phase: tool && ["source-reading", "drafting", "qa"].includes(String(args.phase)) ? String(args.phase) : undefined,
    startPage: tool ? page(args.startPage) ?? page(cursor.pageNumber) : undefined,
    endPage: tool ? page(args.endPage) : undefined,
    body: "parsed",
  };
}

async function boundedJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new Error("omitted");
  const clone = request.clone();
  observationClones.set(request, clone);
  const reader = clone.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  let completed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("omitted")), 1000); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) { completed = true; break; }
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error("omitted");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
    // Awaiting cancel on a cloned stream can wait for its original consumer.
    // The original request must remain usable by the protected MCP handler.
    if (completed) reader.releaseLock();
    else void reader.cancel().catch(() => undefined);
  }
}

async function append(receipt: McpReceipt) {
  const next = writing.catch(() => undefined).then(async () => {
    await mkdir(root(), { recursive: true });
    const size = await stat(logFile()).then(s => s.size).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    });
    if (size >= MAX_LOG_BYTES) await rename(logFile(), logFile() + ".previous");
    await appendFile(logFile(), JSON.stringify(receipt) + "\n", "utf8");
  });
  writing = next;
  return next;
}

export async function recordMcpRequest(request: Request) {
  if (process.env.HANEUL_IMPORT_MONITOR_DISABLED === "1") return;
  const at = new Date().toISOString();
  let receipt: McpReceipt = { id: randomUUID(), at, method: request.method, body: "none" };
  if (request.method === "POST") {
    try { receipt = describeMcpReceipt(await boundedJson(request), at); }
    catch { receipt.body = "omitted"; }
  }
  await append(receipt);
}

export async function readMcpReceipts(jobId?: string): Promise<McpReceipt[]> {
  const groups = await Promise.all([logFile() + ".previous", logFile()].map(async file => {
    try {
      if ((await stat(/*turbopackIgnore: true*/ file)).size > MAX_LOG_BYTES + 4096) throw new Error("Log quá giới hạn.");
      const content = await readFile(/*turbopackIgnore: true*/ file, "utf8");
      return content.split("\n").flatMap(line => {
        try { const receipt = JSON.parse(line) as McpReceipt; return receipt.id && receipt.at && receipt.method ? [receipt] : []; }
        catch { return []; } // A concurrent append can leave a partial last line.
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }));
  return groups.flat().filter(r => !jobId || !r.jobId || r.jobId === jobId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);
}
