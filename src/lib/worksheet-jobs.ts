import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { worksheetDraftSchema, worksheetRequestSchema, type WorksheetItem } from "@/lib/worksheet-contract";

export type WorksheetSource = z.infer<typeof worksheetRequestSchema>;
type Job = { id: string; owner: string; keyHash: string; createdAt: number; digest: string; source: WorksheetSource; items: WorksheetItem[] | null };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const validId = z.string().uuid();
const EXPIRES = 24 * 60 * 60 * 1000;
const locks = new Set<string>();

/** Separate worksheet storage; no imports from curriculum/compilation stores. */
export class WorksheetJobStore {
  constructor(private root = process.env.HANEUL_WORKSHEET_DIR || path.join(process.cwd(), ".haneul", "worksheet-jobs")) {}
  private file(id: string) { return path.join(this.root, validId.parse(id) + ".json"); }
  private async save(job: Job) {
    await mkdir(this.root, { recursive: true });
    const temporary = this.file(job.id) + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(job), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.file(job.id));
  }
  private async load(id: string): Promise<Job> {
    const job = JSON.parse(await readFile(this.file(id), "utf8")) as Job;
    if (Date.now() - job.createdAt > EXPIRES) { await rm(this.file(id), { force: true }); throw new Error("Bài tập đã hết hạn sau 24 giờ."); }
    return job;
  }
  async create(owner: string, source: WorksheetSource) {
    await mkdir(this.root, { recursive: true });
    let active = 0;
    for (const file of await readdir(this.root)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
      try {
        const job = await this.load(file.slice(0, -5));
        if (job.owner === owner) active++;
      } catch { /* Expired jobs are pruned by load. */ }
    }
    if (active >= 12) throw new Error("Bạn có 12 bài đang lưu. Xóa bài cũ trước khi tạo thêm.");
    const accessKey = randomBytes(32).toString("base64url");
    const id = randomUUID();
    const job: Job = { id, owner, keyHash: hash(accessKey), createdAt: Date.now(), digest: hash(JSON.stringify(source)), source, items: null };
    await this.save(job);
    return { id, accessKey, digest: job.digest };
  }
  async owned(id: string, owner: string) {
    const job = await this.load(id);
    if (job.owner !== owner) throw new Error("Không tìm thấy bài tập của bạn.");
    return { id, status: job.items ? "ready" : "waiting", items: job.items, createdAt: job.createdAt, sourcePages: job.source.action === "extract" ? job.source.pages.filter((page) => page.image).map((page) => page.page) : [], expiresAt: job.createdAt + EXPIRES };
  }
  async remove(id: string, owner: string) {
    await this.owned(id, owner);
    await rm(this.file(id), { force: true });
  }
  private async authorized(id: string, accessKey: string) {
    const job = await this.load(id);
    if (!timingSafeEqual(Buffer.from(job.keyHash, "hex"), Buffer.from(hash(accessKey), "hex"))) throw new Error("Mã truy cập bài tập không hợp lệ.");
    return job;
  }
  async read(id: string, accessKey: string, page?: number) {
    const job = await this.authorized(id, accessKey);
    if (job.source.action === "solve") return { digest: job.digest, questions: job.source.questions };
    if (page === undefined) return { digest: job.digest, pages: job.source.pages.map((p) => ({ page: p.page, text: p.text, hasImage: Boolean(p.image) })) };
    const sourcePage = job.source.pages.find((p) => p.page === page);
    if (!sourcePage) throw new Error("Không tìm thấy trang.");
    return { digest: job.digest, pages: [sourcePage] };
  }
  async submit(id: string, accessKey: string, digest: string, input: unknown) {
    if (locks.has(id)) throw new Error("Bài tập đang được ghi. Thử lại sau.");
    locks.add(id);
    try {
      const job = await this.authorized(id, accessKey);
      if (job.digest !== digest) throw new Error("Nguồn bài tập không khớp.");
      const { items } = worksheetDraftSchema.parse(input);
      if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Câu hỏi bị trùng ID.");
      if (job.source.action === "solve") {
        const source = job.source.questions;
        if (items.length !== source.length || items.some((item, i) => item.id !== source[i].id || item.question !== source[i].question || item.page !== source[i].page)) throw new Error("Kết quả phải giữ đúng câu đề và thứ tự nguồn.");
      } else {
        const pages = job.source.pages;
        if (items.some((item) => !pages.some((p) => p.page === item.page))) throw new Error("Kết quả tham chiếu trang không có trong nguồn.");
      }
      if (items.some((item) => !item.answer.trim() && !item.warning.trim())) throw new Error("Câu chưa giải phải nêu lý do trong warning.");
      if (job.items && JSON.stringify(job.items) !== JSON.stringify(items)) throw new Error("Bài tập đã có kết quả. Tạo lượt mới nếu cần thay đổi.");
      await this.save({ ...job, items });
      return { id, status: "ready", count: items.length };
    } finally { locks.delete(id); }
  }
}

export const worksheetJobs = new WorksheetJobStore();
