import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Webhook } from "standardwebhooks";
import { WorksheetCallbackError, WorksheetEventStore, WORKSHEET_EVENT, publicWorksheetAddress, worksheetCallbackUrl } from "@/lib/worksheet-events";
import { WorksheetJobStore } from "@/lib/worksheet-jobs";
import { WorksheetActivityStore } from "@/lib/worksheet-activity";

const directories: string[] = [];
afterEach(async () => { vi.useRealTimers(); for (const directory of directories.splice(0)) { if (!directory.startsWith(path.join(tmpdir(), "haneul-worksheet-events-"))) throw new Error("Unexpected test path"); await rm(directory, { recursive: true, force: true }); } });
const secret = () => "whsec_" + randomBytes(32).toString("base64");
const data = () => ({ jobId: randomUUID(), accessKey: randomBytes(32).toString("base64url"), sourceDigest: "a".repeat(64), expiresAt: new Date(Date.now() + 86400_000).toISOString() });
function params(channelKey: string, signingSecret = secret(), url = "https://callback.example.com/events") { return { name: WORKSHEET_EVENT, arguments: { channelKey }, delivery: { mode: "webhook", url, secret: signingSecret }, cursor: null }; }
async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "haneul-worksheet-events-")); directories.push(root);
  const deliveries: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const transport = vi.fn(async (url: string, body: string, headers: Record<string, string>) => {
    deliveries.push({ url, body, headers });
    const payload = JSON.parse(body);
    return { status: 200, body: JSON.stringify({ challenge: payload.challenge }) };
  });
  const events = new WorksheetEventStore(root, transport);
  return { root, events, transport, deliveries };
}

describe("worksheet event capabilities and signed delivery", () => {
  it("verifies callback before activation and signs the exact event bytes", async () => {
    const { events, deliveries } = await setup();
    const channel = await events.channel("alice"); const input = params(channel.key);
    const subscription = await events.subscribe(input);
    expect(JSON.parse(deliveries[0].body).type).toBe("verification");
    expect(new Webhook(input.delivery.secret).verify(deliveries[0].body, deliveries[0].headers)).toMatchObject({ type: "verification" });
    const job = data(); expect(await events.publish("alice", job)).toEqual({ state: "delivered" });
    const delivery = deliveries[1];
    const payload = new Webhook(input.delivery.secret).verify(delivery.body, delivery.headers);
    expect(payload).toMatchObject({ name: WORKSHEET_EVENT, data: job, cursor: null });
    expect(delivery.headers["webhook-id"]).toBe("evt_worksheet_" + job.jobId);
    expect(delivery.headers["X-MCP-Subscription-Id"]).toBe(subscription.id);
    expect(delivery.body).not.toContain(channel.key);
  });
  it("rejects unknown channel and wrong verification echo without storing a subscription", async () => {
    const { events, transport } = await setup();
    await expect(events.subscribe(params("x".repeat(43)))).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
    const channel = await events.channel("alice");
    transport.mockResolvedValue({ status: 200, body: '{"challenge":"wrong"}' });
    await expect(events.subscribe(params(channel.key))).rejects.toBeInstanceOf(WorksheetCallbackError);
    expect((await events.status("alice")).configured).toBe(false);
  });
  it("never sends one owner's event to another owner's callback", async () => {
    const { events, transport } = await setup();
    const alice = await events.channel("alice"), bob = await events.channel("bob");
    await events.subscribe(params(alice.key, secret(), "https://callback.example.com/alice"));
    await events.subscribe(params(bob.key, secret(), "https://callback.example.com/bob"));
    transport.mockClear(); await events.publish("alice", data());
    expect(transport).toHaveBeenCalledTimes(1); expect(transport.mock.calls[0][0]).toContain("/alice");
    expect(await events.publish("carol", data())).toEqual({ state: "unconfigured" });
  });
  it("persists channels and refresh across restart; rotates secrets with both signatures", async () => {
    const { events, root, transport, deliveries } = await setup();
    const channel = await events.channel("alice"), old = params(channel.key);
    const first = await events.subscribe(old);
    const restarted = new WorksheetEventStore(root, transport);
    expect(await restarted.channel("alice")).toEqual(channel);
    expect((await restarted.status("alice")).configured).toBe(true);
    const next = params(channel.key);
    expect((await restarted.subscribe(next)).id).toBe(first.id);
    await restarted.publish("alice", data());
    const delivery = deliveries.at(-1)!;
    expect(() => new Webhook(old.delivery.secret).verify(delivery.body, delivery.headers)).not.toThrow();
    expect(() => new Webhook(next.delivery.secret).verify(delivery.body, delivery.headers)).not.toThrow();
    expect(() => new Webhook(next.delivery.secret).verify(delivery.body + " ", delivery.headers)).toThrow();
  });
  it("uses a single worker chat; supports idempotent unsubscribe and revoke", async () => {
    const { events, transport } = await setup(); const channel = await events.channel("alice");
    const a = params(channel.key), b = params(channel.key, secret(), "https://callback.example.com/new-chat");
    await events.subscribe(a); await events.subscribe(b);
    expect((await events.status("alice")).activeSubscriptions).toBe(1);
    await events.unsubscribe(a); expect((await events.status("alice")).configured).toBe(true);
    await events.unsubscribe(b); await events.unsubscribe(b);
    expect((await events.status("alice")).configured).toBe(false);
    await events.subscribe(a); await events.revoke("alice");
    transport.mockClear(); expect(await events.publish("alice", data())).toEqual({ state: "unconfigured" });
    await expect(events.subscribe(a)).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  });
  it("honors finite TTL and rejects delivery after expiry", async () => {
    const { events, transport } = await setup(); const channel = await events.channel("alice");
    const now = Date.now(); vi.useFakeTimers(); vi.setSystemTime(now);
    const sub = await events.subscribe({ ...params(channel.key), ttlMs: 90_000 });
    expect(Date.parse(sub.refreshBefore)).toBe(now + 90_000);
    vi.setSystemTime(now + 91_000); transport.mockClear();
    expect(await events.publish("alice", data())).toEqual({ state: "unconfigured" }); expect(transport).not.toHaveBeenCalled();
    const finite = await events.subscribe({ ...params(channel.key), ttlMs: null }); expect(finite.refreshBefore).toBeTypeOf("string");
  });
  it("does not resurrect a subscription when revocation overlaps callback verification", async () => {
    const { events, transport } = await setup(); const channel = await events.channel("alice");
    let verified!: () => void, reached!: () => void;
    const waiting = new Promise<void>((resolve) => { reached = resolve; });
    const release = new Promise<void>((resolve) => { verified = resolve; });
    transport.mockImplementationOnce(async (_url, body) => { reached(); await release; return { status: 200, body: JSON.stringify({ challenge: JSON.parse(body).challenge }) }; });
    const subscribe = events.subscribe(params(channel.key)); await waiting;
    const revoke = events.revoke("alice"); verified();
    await Promise.all([subscribe, revoke]);
    expect((await events.status("alice")).configured).toBe(false);
    expect(await events.publish("alice", data())).toEqual({ state: "unconfigured" });
  });
  it("preserves event ID/body on transient retry and does not retry 410/413", async () => {
    const { root, events, transport } = await setup(); const channel = await events.channel("alice");
    await events.subscribe(params(channel.key)); transport.mockClear();
    transport.mockResolvedValueOnce({ status: 503, body: "" });
    const job = data(); expect(await events.publish("alice", job)).toEqual({ state: "delivered" });
    expect(transport.mock.calls).toHaveLength(2);
    expect(transport.mock.calls[0][1]).toBe(transport.mock.calls[1][1]);
    expect((await new WorksheetActivityStore(path.join(root, "activity")).list(job.jobId)).map((entry) => [entry.kind, entry.httpStatus, entry.attempt])).toEqual([["dispatch_failed", 503, 1], ["dispatch_accepted", 200, 2]]);
    for (const code of [413, 410]) {
      transport.mockClear(); transport.mockResolvedValueOnce({ status: code, body: "" });
      expect(await events.publish("alice", job)).toEqual({ state: "failed" }); expect(transport).toHaveBeenCalledTimes(1);
    }
    expect((await events.status("alice")).configured).toBe(false);
  });
  it("round-trips queued job through read/submit to ready without handoff", async () => {
    const { root, events, transport } = await setup(); const jobs = new WorksheetJobStore(path.join(root, "jobs"));
    const channel = await events.channel("alice"); await events.subscribe(params(channel.key));
    const question = { id: "q1", page: 1, question: "Hoa là người Việt Nam.", instruction: "Dịch Việt Hàn", warning: "" };
    const job = await jobs.create("alice", { action: "solve", questions: [question] });
    transport.mockImplementationOnce(async (_url, body) => {
      const payload = JSON.parse(body); const source = await jobs.read(payload.data.jobId, payload.data.accessKey);
      await jobs.submit(payload.data.jobId, payload.data.accessKey, source.digest, { version: 1, items: [{ ...question, answer: "호아 씨는 베트남 사람입니다.", translation: "" }] });
      return { status: 200, body: "{}" };
    });
    const status = await jobs.owned(job.id, "alice");
    expect(await events.publish("alice", { jobId: job.id, accessKey: job.accessKey, sourceDigest: job.digest, expiresAt: new Date(status.expiresAt).toISOString() })).toEqual({ state: "delivered" });
    expect(await jobs.owned(job.id, "alice")).toMatchObject({ status: "ready", items: [{ question: question.question, answer: "호아 씨는 베트남 사람입니다." }] });
  });
});

describe("worksheet callback isolation", () => {
  it("rejects local/private/documentation and mapped IPs; allows public IPv4/IPv6", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "172.31.0.2", "192.168.1.5", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:8.8.8.8", "2001:0000::1", "2001:db8::1", "2002::1"]) expect(publicWorksheetAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2404:6800::1"]) expect(publicWorksheetAddress(ip), ip).toBe(true);
  });
  it("rejects non-HTTPS, credentials, fragments, private IPs and alternate ports", () => {
    for (const url of ["http://callback.example.com", "https://a:b@callback.example.com", "https://127.0.0.1", "https://[::1]", "https://callback.example.com:8443", "https://callback.example.com#fragment"]) expect(() => worksheetCallbackUrl(url)).toThrow();
    expect(worksheetCallbackUrl("https://callback.example.com/events").hostname).toBe("callback.example.com");
  });
});
