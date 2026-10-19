import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import path from "node:path";
import { Webhook } from "standardwebhooks";
import { z } from "zod";
import { WorksheetActivityStore } from "@/lib/worksheet-activity";

export const WORKSHEET_EVENT = "worksheet_job.queued";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const channelKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const filterSchema = z.object({ channelKey: channelKeySchema }).strict();
const deliverySchema = z.object({ mode: z.literal("webhook"), url: z.string().url().max(2048) });
const subscriptionSchema = z.object({ name: z.literal(WORKSHEET_EVENT), arguments: filterSchema, delivery: deliverySchema.extend({ secret: z.string().regex(/^whsec_[A-Za-z0-9+/]+={0,2}$/).max(100) }), cursor: z.null().optional(), ttlMs: z.number().int().positive().nullable().optional() });
type Channel = { owner: string; key: string };
type Subscription = { id: string; owner: string; url: string; secret: string; expires: number; previousSecret?: string; rotationUntil?: number };
type Transport = (url: string, body: string, headers: Record<string, string>) => Promise<{ status: number; body: string }>;
const mutations = new Map<string, Promise<void>>();
async function withOwner<T>(owner: string, operation: () => Promise<T>): Promise<T> {
  const previous = mutations.get(owner) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  mutations.set(owner, current);
  await previous;
  try { return await operation(); }
  finally { release(); if (mutations.get(owner) === current) mutations.delete(owner); }
}
export type WorksheetDispatch = { state: "delivered" | "unconfigured" | "failed" | "ready" };

export const worksheetEventDefinition = {
  name: WORKSHEET_EVENT,
  description: "A new Korean/Vietnamese worksheet uploaded by the learner who authorized this channel. Read and submit only the job identified by this event. Not a curriculum compilation event.",
  delivery: ["webhook"],
  inputSchema: { type: "object", properties: { channelKey: { type: "string", description: "Private channel code supplied by the learner during one-time setup in Haneul." } }, required: ["channelKey"], additionalProperties: false },
  payloadSchema: { type: "object", properties: { jobId: { type: "string" }, accessKey: { type: "string" }, sourceDigest: { type: "string" }, expiresAt: { type: "string" } }, required: ["jobId", "accessKey", "sourceDigest", "expiresAt"], additionalProperties: false },
};

// Only global unicast destinations. IPv4-mapped IPv6 cannot bypass IPv4 checks.
export function publicWorksheetAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    const parts = normalized.split(":").map((part) => parseInt(part || "0", 16));
    // Global unicast is 2000::/3; exclude documentation/special ranges.
    return /^[23][0-9a-f]{3}:/.test(normalized) && parts[0] !== 0x2002 && parts[0] !== 0x3fff && !(parts[0] === 0x2001 && [0, 2, 0x10, 0x20, 0xdb8].includes(parts[1]));
  }
  return false;
}
export function worksheetCallbackUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) throw new Error("Callback phải dùng HTTPS cổng 443.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !publicWorksheetAddress(hostname)) throw new Error("Callback không được trỏ vào mạng nội bộ.");
  return url;
}

/** Resolve on each delivery and pin the checked IP in the TLS connection. Never follow redirects. */
async function sendHttps(value: string, body: string, headers: Record<string, string>) {
  const url = worksheetCallbackUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let dnsTimeout: ReturnType<typeof setTimeout>;
  const addresses = await Promise.race([lookup(hostname, { all: true, verbatim: true }), new Promise<never>((_resolve, reject) => { dnsTimeout = setTimeout(() => reject(new Error("DNS timeout")), 5000); })]).finally(() => clearTimeout(dnsTimeout));
  if (!addresses.length || addresses.some((entry) => !publicWorksheetAddress(entry.address))) throw new Error("Callback không có địa chỉ công cộng hợp lệ.");
  const destination = addresses[0];
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = httpsRequest(url, {
      method: "POST", headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
      // Explicit address lookup keeps DNS rebinding from changing the connection target.
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [destination]);
        else callback(null, destination.address, destination.family);
      },
    }, (response) => {
      const chunks: Buffer[] = []; let length = 0;
      response.on("data", (chunk: Buffer) => { length += chunk.length; if (length > 65_536) req.destroy(new Error("Callback response too large")); else chunks.push(chunk); });
      response.on("error", reject);
      response.on("end", () => resolve({ status: response.statusCode ?? 500, body: Buffer.concat(chunks).toString("utf8") }));
    });
    const timeout = setTimeout(() => req.destroy(new Error("Callback timeout")), 10_000);
    req.on("close", () => clearTimeout(timeout)); req.on("error", reject); req.end(body);
  });
}

export class WorksheetEventStore {
  constructor(private root = process.env.HANEUL_WORKSHEET_EVENTS_DIR || path.join(process.cwd(), ".haneul", "worksheet-events"), private transport: Transport = sendHttps) {}
  private file(name: string) { return path.join(this.root, name + ".json"); }
  private async save(name: string, value: unknown) {
    await mkdir(this.root, { recursive: true });
    const temporary = this.file(name) + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.file(name));
  }
  async channel(owner: string): Promise<Channel> {
    const name = "channel_" + hash(owner);
    try { return JSON.parse(await readFile(this.file(name), "utf8")) as Channel; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(this.root, { recursive: true });
    const channel = { owner, key: randomBytes(32).toString("base64url") };
    try { await writeFile(this.file(name), JSON.stringify(channel), { encoding: "utf8", mode: 0o600, flag: "wx" }); return channel; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return JSON.parse(await readFile(this.file(name), "utf8")) as Channel; throw error; }
  }
  private async ownerFor(key: string) {
    channelKeySchema.parse(key);
    for (const file of await this.files("channel_")) {
      const channel = JSON.parse(await readFile(path.join(this.root, file), "utf8")) as Channel;
      if (timingSafeEqual(Buffer.from(hash(channel.key), "hex"), Buffer.from(hash(key), "hex"))) return channel.owner;
    }
    throw new Error("Mã kênh không hợp lệ hoặc đã bị thu hồi.");
  }
  private async files(prefix: string) { try { return (await readdir(this.root)).filter((file) => new RegExp("^" + prefix + "[a-f0-9]{64}\\.json$").test(file)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }
  private async subscriptions(owner: string) {
    const result: Subscription[] = [];
    for (const file of await this.files("sub_")) {
      const sub = JSON.parse(await readFile(path.join(this.root, file), "utf8")) as Subscription;
      if (sub.expires <= Date.now()) { await rm(path.join(this.root, file), { force: true }); continue; }
      if (sub.owner === owner) result.push(sub);
    }
    return result;
  }
  async status(owner: string) {
    const subscriptions = await this.subscriptions(owner);
    return { configured: subscriptions.length > 0, activeSubscriptions: subscriptions.length, refreshBefore: subscriptions.length ? new Date(Math.min(...subscriptions.map((sub) => sub.expires))).toISOString() : null };
  }
  async revoke(owner: string) {
    return withOwner(owner, async () => {
    for (const sub of await this.subscriptions(owner)) await rm(this.file(sub.id), { force: true });
    await rm(this.file("channel_" + hash(owner)), { force: true });
    });
  }
  private identity(owner: string, url: string) { return "sub_" + hash(JSON.stringify([owner, WORKSHEET_EVENT, url])); }
  private async signed(sub: Subscription, id: string, payload: unknown) {
    const body = JSON.stringify(payload); const now = new Date();
    const signatures = [new Webhook(sub.secret).sign(id, now, body)];
    if (sub.previousSecret && (sub.rotationUntil ?? 0) > Date.now()) signatures.push(new Webhook(sub.previousSecret).sign(id, now, body));
    return this.transport(sub.url, body, { "Content-Type": "application/json", "webhook-id": id, "webhook-timestamp": String(Math.floor(now.getTime() / 1000)), "webhook-signature": signatures.join(" "), "X-MCP-Subscription-Id": sub.id });
  }
  async subscribe(input: unknown) {
    const params = subscriptionSchema.parse(input);
    const owner = await this.ownerFor(params.arguments.channelKey);
    return withOwner(owner, async () => {
    await this.ownerFor(params.arguments.channelKey);
    const key = Buffer.from(params.delivery.secret.slice(6), "base64");
    if (key.length < 24 || key.length > 64) throw new Error("Signing key không hợp lệ.");
    const url = worksheetCallbackUrl(params.delivery.url).href;
    const id = this.identity(owner, url);
    const existing = (await this.subscriptions(owner)).find((sub) => sub.id === id);
    // One worker chat per account; replacing its callback avoids double-solving.
    const lifetime = Math.max(60_000, Math.min(params.ttlMs ?? 180 * 86400_000, 180 * 86400_000));
    const sub: Subscription = { id, owner, url, secret: params.delivery.secret, expires: Date.now() + lifetime };
    if (existing && existing.secret !== sub.secret) { sub.previousSecret = existing.secret; sub.rotationUntil = Date.now() + 300_000; }
    else if (existing?.previousSecret && (existing.rotationUntil ?? 0) > Date.now()) { sub.previousSecret = existing.previousSecret; sub.rotationUntil = existing.rotationUntil; }
    const challenge = randomBytes(32).toString("base64url");
    try {
      const response = await this.signed(sub, "msg_verification_" + randomUUID(), { type: "verification", challenge });
      const echoed: unknown = JSON.parse(response.body);
      const actual = typeof echoed === "object" && echoed && "challenge" in echoed ? String(echoed.challenge) : "";
      if (response.status < 200 || response.status >= 300 || actual.length !== challenge.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(challenge))) throw new Error("challenge_failed");
    } catch { throw new WorksheetCallbackError(); }
    await this.save(id, sub);
    for (const other of await this.subscriptions(owner)) if (other.id !== id) await rm(this.file(other.id), { force: true });
    return { id, refreshBefore: new Date(sub.expires).toISOString(), cursor: null, truncated: false };
    });
  }
  async unsubscribe(input: unknown) {
    const params = z.object({ name: z.literal(WORKSHEET_EVENT), arguments: filterSchema, delivery: deliverySchema }).parse(input);
    const owner = await this.ownerFor(params.arguments.channelKey);
    return withOwner(owner, async () => {
    await this.ownerFor(params.arguments.channelKey);
    const url = worksheetCallbackUrl(params.delivery.url).href;
    await rm(this.file(this.identity(owner, url)), { force: true });
    return {};
    });
  }
  async publish(owner: string, data: { jobId: string; accessKey: string; sourceDigest: string; expiresAt: string }): Promise<WorksheetDispatch> {
    const activity = new WorksheetActivityStore(path.join(this.root, "activity"));
    const subscriptions = await this.subscriptions(owner);
    if (!subscriptions.length) { await activity.record(data.jobId, { kind: "dispatch_unconfigured" }); return { state: "unconfigured" }; }
    // Stable occurrence time/ID across retries; payload contains capabilities, never worksheet instructions/content.
    const eventId = "evt_worksheet_" + data.jobId;
    const event = { eventId, name: WORKSHEET_EVENT, timestamp: new Date(Date.parse(data.expiresAt) - 86400_000).toISOString(), data, cursor: null };
    let delivered = false;
    for (const sub of subscriptions) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const active = (await this.subscriptions(owner)).find((candidate) => candidate.id === sub.id && candidate.secret === sub.secret);
        if (!active) break;
        try {
          const response = await this.signed(sub, eventId, event);
          await activity.record(data.jobId, { kind: response.status >= 200 && response.status < 300 ? "dispatch_accepted" : "dispatch_failed", httpStatus: response.status, attempt: attempt + 1 });
          if (response.status >= 200 && response.status < 300) { delivered = true; break; }
          if (response.status === 410) { await rm(this.file(sub.id), { force: true }); break; }
          if (response.status === 413 || (response.status < 500 && response.status !== 429)) break;
        } catch { await activity.record(data.jobId, { kind: "dispatch_failed", attempt: attempt + 1 }); }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** attempt));
      }
    }
    return { state: delivered ? "delivered" : "failed" };
  }
}
export class WorksheetCallbackError extends Error { constructor() { super("Không xác minh được callback ChatGPT."); } }
export const worksheetEvents = new WorksheetEventStore();
