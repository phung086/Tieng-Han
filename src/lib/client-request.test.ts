import { afterEach, expect, it, vi } from "vitest";
import { clientJson } from "@/lib/client-request";
afterEach(() => vi.unstubAllGlobals());
it("times out stalled reads without automatically retrying writes", async () => {
  const fetch = vi.fn((_url, init: RequestInit) => new Promise<Response>((_, reject) => {
    init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  await expect(clientJson("/api/test", { method: "POST" }, 30)).rejects.toThrow("Thao tác có thể đã được lưu");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("preserves server status for expired-job recovery", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Hết hạn" }, { status: 404 })));
  await expect(clientJson("/api/test")).rejects.toMatchObject({ message: "Hết hạn", status: 404 });
});
