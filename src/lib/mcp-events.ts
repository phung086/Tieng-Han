import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Webhook } from "standardwebhooks";
import type { ImportJob } from "@/lib/import-jobs";

export const HANEUL_IMPORT_QUEUED_EVENT = "import_job.queued";
export const MCP_EVENTS_PROTOCOL_VERSION = "2026-07-28";

type EventSubscription = {
  id: string;
  owner: string;
  name: typeof HANEUL_IMPORT_QUEUED_EVENT;
  arguments: {
    targetLanguage?: string;
  };
  url: string;
  secret: string;
  createdAt: string;
  refreshBefore: string | null;
};

type EventStore = {
  version: 1;
  subscriptions: EventSubscription[];
};

const eventRoot =
  process.env.HANEUL_EVENT_DIR ||
  path.join(process.cwd(), ".haneul", "mcp-events");
const subscriptionsFile = path.join(eventRoot, "subscriptions.json");

const emptyStore: EventStore = {
  version: 1,
  subscriptions: [],
};

function jsonResponse(
  id: unknown,
  result?: unknown,
  error?: { code: number; message: string; data?: unknown },
) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      ...(error ? { error } : { result }),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temp = filePath + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await rename(temp, filePath);
}

async function readStore(): Promise<EventStore> {
  try {
    const raw = await readFile(subscriptionsFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<EventStore>;
    return {
      version: 1,
      subscriptions: Array.isArray(parsed.subscriptions)
        ? parsed.subscriptions
        : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyStore;
    }
    throw error;
  }
}

async function saveStore(store: EventStore) {
  await writeJsonAtomic(subscriptionsFile, store);
}

export async function getMcpEventSetupStatus() {
  const store = await readStore();
  const now = Date.now();
  const activeSubscriptions = store.subscriptions.filter((subscription) => {
    if (!subscription.refreshBefore) return true;
    return new Date(subscription.refreshBefore).getTime() > now;
  });

  return {
    configured: activeSubscriptions.length > 0,
    activeSubscriptions: activeSubscriptions.length,
    nextRefreshBefore:
      activeSubscriptions
        .map((item) => item.refreshBefore)
        .filter((item): item is string => Boolean(item))
        .sort()[0] ?? null,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }

  const record = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(record)
      .sort()
      .map(
        (key) =>
          JSON.stringify(key) + ":" + canonicalJson(record[key]),
      )
      .join(",") +
    "}"
  );
}

function subscriptionId(input: {
  owner: string;
  url: string;
  name: string;
  arguments: unknown;
}) {
  return (
    "sub_" +
    createHash("sha256")
      .update(
        input.owner +
          "\n" +
          input.url +
          "\n" +
          input.name +
          "\n" +
          canonicalJson(input.arguments),
      )
      .digest("hex")
      .slice(0, 32)
  );
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.includes(":")) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    );
  }

  return isPrivateIpv4(normalized);
}

async function validateCallbackUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (url.protocol !== "https:") {
    throw new Error("Callback MCP Events bắt buộc dùng HTTPS.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Callback URL không được trỏ vào local network.");
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((item) => isPrivateAddress(item.address))) {
    throw new Error("Callback URL phải resolve tới public IP.");
  }

  return url;
}

function validateSigningSecret(secret: string) {
  if (!secret.startsWith("whsec_")) {
    throw new Error("Signing secret MCP Events phải bắt đầu bằng whsec_.");
  }

  const encoded = secret.slice("whsec_".length);
  let decoded: Buffer;

  try {
    decoded = Buffer.from(encoded, "base64");
  } catch {
    throw new Error("Signing secret MCP Events không phải base64 hợp lệ.");
  }

  if (decoded.length < 24 || decoded.length > 64) {
    throw new Error("Signing secret MCP Events phải giải mã thành 24–64 bytes.");
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function signedWebhookRequest(input: {
  subscription: EventSubscription;
  webhookId: string;
  body: string;
}) {
  const signer = new Webhook(input.subscription.secret);
  const signedAt = new Date();

  return fetch(input.subscription.url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      "webhook-id": input.webhookId,
      "webhook-timestamp": String(Math.floor(signedAt.getTime() / 1000)),
      "webhook-signature": signer.sign(
        input.webhookId,
        signedAt,
        input.body,
      ),
      "X-MCP-Subscription-Id": input.subscription.id,
    },
    body: input.body,
  });
}

async function verifyCallback(subscription: EventSubscription) {
  await validateCallbackUrl(subscription.url);

  const challenge = randomUUID();
  const webhookId = "msg_verification_" + randomUUID();
  const body = JSON.stringify({
    type: "verification",
    challenge,
  });

  const response = await signedWebhookRequest({
    subscription,
    webhookId,
    body,
  });

  if (!response.ok) {
    throw new Error(
      "Callback verification HTTP " + response.status + ".",
    );
  }

  const payload = (await response.json()) as { challenge?: string };
  if (
    typeof payload.challenge !== "string" ||
    !safeEqual(payload.challenge, challenge)
  ) {
    throw new Error("Callback verification challenge không khớp.");
  }
}

export const haneulEventDefinition = {
  name: HANEUL_IMPORT_QUEUED_EVENT,
  description:
    "A textbook import job finished local extraction and is ready for automatic ChatGPT compilation. On receipt, compile the job to completion using the Haneul tools and get_compilation_contract; preserve source grounding and finalize the course instead of asking the user to configure each run.",
  delivery: ["webhook"],
  inputSchema: {
    type: "object",
    properties: {
      targetLanguage: {
        type: "string",
        description:
          "Optional target language code such as ko, en, or zh. Omit to receive every queued textbook import.",
      },
    },
    additionalProperties: false,
  },
  payloadSchema: {
    type: "object",
    properties: {
      jobId: { type: "string" },
      courseTitle: { type: "string" },
      level: { type: "string" },
      targetLanguage: { type: "string" },
      learnerLanguage: { type: "string" },
      totalPages: { type: "number" },
      sourceFiles: {
        type: "array",
        items: { type: "string" },
      },
      status: { type: "string" },
    },
    required: [
      "jobId",
      "courseTitle",
      "level",
      "targetLanguage",
      "learnerLanguage",
      "totalPages",
      "sourceFiles",
      "status",
    ],
    additionalProperties: false,
  },
} as const;

export async function handleMcpEventRpc(
  request: Request,
): Promise<Response | null> {
  if (request.method !== "POST") return null;

  let rpc: {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: Record<string, unknown>;
  };

  try {
    rpc = (await request.clone().json()) as typeof rpc;
  } catch {
    return null;
  }

  if (!rpc || Array.isArray(rpc) || typeof rpc.method !== "string") {
    return null;
  }

  if (rpc.method === "server/discover") {
    return jsonResponse(rpc.id, {
      resultType: "complete",
      supportedVersions: [MCP_EVENTS_PROTOCOL_VERSION],
      capabilities: {
        tools: {},
        events: {},
      },
    });
  }

  if (rpc.method === "events/list") {
    return jsonResponse(rpc.id, {
      events: [haneulEventDefinition],
    });
  }

  if (rpc.method === "events/subscribe") {
    try {
      const params = rpc.params ?? {};
      const name = String(params.name ?? "");
      const argumentsValue =
        params.arguments && typeof params.arguments === "object"
          ? (params.arguments as Record<string, unknown>)
          : {};
      const delivery =
        params.delivery && typeof params.delivery === "object"
          ? (params.delivery as Record<string, unknown>)
          : {};

      if (name !== HANEUL_IMPORT_QUEUED_EVENT) {
        return jsonResponse(rpc.id, undefined, {
          code: -32602,
          message: "Unsupported event name.",
        });
      }

      const targetLanguage =
        typeof argumentsValue.targetLanguage === "string"
          ? argumentsValue.targetLanguage
          : undefined;

      if (
        Object.keys(argumentsValue).some(
          (key) => key !== "targetLanguage",
        )
      ) {
        return jsonResponse(rpc.id, undefined, {
          code: -32602,
          message: "Unsupported subscription argument.",
        });
      }

      if (delivery.mode !== "webhook") {
        return jsonResponse(rpc.id, undefined, {
          code: -32602,
          message: "Only webhook delivery is supported.",
        });
      }

      const url = String(delivery.url ?? "");
      const secret = String(delivery.secret ?? "");
      validateSigningSecret(secret);
      await validateCallbackUrl(url);

      const owner = "anonymous-dev";
      const args = targetLanguage ? { targetLanguage } : {};
      const id = subscriptionId({
        owner,
        url,
        name,
        arguments: args,
      });
      const ttlMsRaw = params.ttlMs;
      const ttlMs =
        typeof ttlMsRaw === "number" && Number.isFinite(ttlMsRaw)
          ? Math.max(60_000, Math.min(ttlMsRaw, 30 * 24 * 60 * 60 * 1000))
          : 30 * 24 * 60 * 60 * 1000;
      const refreshBefore = new Date(Date.now() + ttlMs).toISOString();

      const subscription: EventSubscription = {
        id,
        owner,
        name: HANEUL_IMPORT_QUEUED_EVENT,
        arguments: args,
        url,
        secret,
        createdAt: new Date().toISOString(),
        refreshBefore,
      };

      await verifyCallback(subscription);

      const store = await readStore();
      const next = store.subscriptions.filter((item) => item.id !== id);
      next.push(subscription);
      await saveStore({
        version: 1,
        subscriptions: next,
      });

      return jsonResponse(rpc.id, {
        id,
        refreshBefore,
        cursor: null,
        truncated: false,
      });
    } catch (error) {
      return jsonResponse(rpc.id, undefined, {
        code: -32015,
        message: "CallbackEndpointError",
        data: {
          reason:
            error instanceof Error ? error.message : "subscription_failed",
        },
      });
    }
  }

  if (rpc.method === "events/unsubscribe") {
    try {
      const params = rpc.params ?? {};
      const name = String(params.name ?? "");
      const argumentsValue =
        params.arguments && typeof params.arguments === "object"
          ? (params.arguments as Record<string, unknown>)
          : {};
      const delivery =
        params.delivery && typeof params.delivery === "object"
          ? (params.delivery as Record<string, unknown>)
          : {};
      const url = String(delivery.url ?? "");
      const owner = "anonymous-dev";

      const args =
        typeof argumentsValue.targetLanguage === "string"
          ? { targetLanguage: argumentsValue.targetLanguage }
          : {};
      const id = subscriptionId({
        owner,
        url,
        name,
        arguments: args,
      });

      const store = await readStore();
      await saveStore({
        version: 1,
        subscriptions: store.subscriptions.filter(
          (item) => item.id !== id,
        ),
      });

      return jsonResponse(rpc.id, {});
    } catch (error) {
      return jsonResponse(rpc.id, undefined, {
        code: -32603,
        message:
          error instanceof Error
            ? error.message
            : "Could not unsubscribe.",
      });
    }
  }

  return null;
}

async function deliverEvent(
  subscription: EventSubscription,
  event: {
    eventId: string;
    name: typeof HANEUL_IMPORT_QUEUED_EVENT;
    timestamp: string;
    data: Record<string, unknown>;
    cursor: null;
  },
) {
  const body = JSON.stringify(event);
  if (Buffer.byteLength(body, "utf8") > 256 * 1024) {
    throw new Error("MCP event payload exceeds 256 KiB.");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await validateCallbackUrl(subscription.url);
      const response = await signedWebhookRequest({
        subscription,
        webhookId: event.eventId,
        body,
      });

      if (response.ok) return;
      if (response.status === 410 || response.status === 413) {
        throw new Error("Webhook rejected with HTTP " + response.status + ".");
      }

      lastError = new Error(
        "Webhook returned HTTP " + response.status + ".",
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 500 * 2 ** attempt),
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("MCP event delivery failed.");
}

export async function publishImportJobQueued(job: ImportJob) {
  const store = await readStore();
  const now = Date.now();
  const active = store.subscriptions.filter((subscription) => {
    if (
      subscription.refreshBefore &&
      new Date(subscription.refreshBefore).getTime() <= now
    ) {
      return false;
    }

    const target = subscription.arguments.targetLanguage;
    return !target || target === job.language.target;
  });

  if (!active.length) return;

  const event = {
    eventId: "evt_" + randomUUID(),
    name: HANEUL_IMPORT_QUEUED_EVENT,
    timestamp: new Date().toISOString(),
    data: {
      jobId: job.id,
      courseTitle: job.courseHint.title,
      level: job.courseHint.level,
      targetLanguage: job.language.target,
      learnerLanguage: job.language.learner,
      totalPages: job.totalPages,
      sourceFiles: job.documents.map((document) => document.fileName),
      status: job.status,
    },
    cursor: null,
  } as const;

  const results = await Promise.allSettled(
    active.map((subscription) =>
      deliverEvent(subscription, event),
    ),
  );

  const failures = results.filter(
    (result) => result.status === "rejected",
  );

  if (failures.length) {
    console.warn(
      "Haneul MCP event delivery failures:",
      failures.length,
    );
  }
}
