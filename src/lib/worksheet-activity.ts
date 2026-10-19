import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

const eventSchema = z.object({
  kind: z.enum(["created", "dispatch_accepted", "dispatch_failed", "dispatch_unconfigured", "read", "submitted", "result_rejected"]),
  at: z.number().int().nonnegative(),
  page: z.number().int().min(1).max(6).optional(),
  count: z.number().int().min(1).max(80).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  attempt: z.number().int().min(1).max(3).optional(),
});
export type WorksheetActivity = z.infer<typeof eventSchema>;
const uuid = z.string().uuid();
const writes = new Map<string, Promise<void>>();

/** Only timestamps and allowlisted counters: never tokens, source text or callback URLs. */
export class WorksheetActivityStore {
  constructor(private root = path.join(process.env.HANEUL_WORKSHEET_EVENTS_DIR || path.join(process.cwd(), ".haneul", "worksheet-events"), "activity")) {}
  private file(id: string) { return path.join(this.root, uuid.parse(id) + ".json"); }
  async list(id: string): Promise<WorksheetActivity[]> {
    try {
      const file = this.file(id);
      if ((await stat(file)).size > 32_768) return [];
      return z.array(eventSchema).max(100).parse(JSON.parse(await readFile(file, "utf8")));
    } catch { return []; }
  }
  async record(id: string, event: Omit<WorksheetActivity, "at">) {
    let file: string;
    try { file = this.file(id); } catch { return; }
    const previous = writes.get(file) ?? Promise.resolve();
    const current = previous.then(async () => {
      const entry = eventSchema.parse({ ...event, at: Date.now() });
      const events = [...await this.list(id), entry].slice(-100);
      await mkdir(this.root, { recursive: true });
      const temporary = file + "." + randomUUID() + ".tmp";
      await writeFile(temporary, JSON.stringify(events), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, file);
      // Prune metadata for expired worksheets; no source/capability is retained here.
      for (const name of await readdir(this.root)) {
        if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
        const target = path.join(this.root, name);
        if (Date.now() - (await stat(target)).mtimeMs > 48 * 3600_000) await rm(target, { force: true });
      }
    }).catch(() => { /* Observability must not interrupt reading, delivery or result saving. */ });
    writes.set(file, current);
    await current;
    if (writes.get(file) === current) writes.delete(file);
  }
  async remove(id: string) {
    const file = this.file(id);
    await writes.get(file);
    await rm(file, { force: true }).catch(() => { /* Metadata cleanup cannot undo successful job deletion. */ });
  }
}
export const worksheetActivity = new WorksheetActivityStore();
