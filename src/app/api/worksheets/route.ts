import { getCurrentUser, isSameOrigin } from "@/lib/auth/server";
import { isDatabaseConfigured } from "@/lib/db";
import { worksheetRequestSchema } from "@/lib/worksheet-contract";
import { processWorksheet } from "@/lib/worksheet-service";

export const runtime = "nodejs";
export const maxDuration = 360;
const BODY_LIMIT = 12_100_000;
const inFlight = new Set<string>();
const recent = new Map<string, number[]>();
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  return json({ available: Boolean(process.env.OPENAI_API_KEY?.trim()), loginRequired: isDatabaseConfigured(), maxPages: 6 });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  const user = await getCurrentUser();
  if ((isDatabaseConfigured() || process.env.NODE_ENV === "production") && !user) return json({ error: "Đăng nhập để nhận diện và dịch bài tập." }, 401);
  if (!process.env.OPENAI_API_KEY?.trim()) return json({ error: "Chưa cấu hình OPENAI_API_KEY trên máy chủ. Bạn vẫn có thể nhập câu và xuất vở." }, 503);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Định dạng yêu cầu không hợp lệ." }, 415);
  const key = user?.id ?? "local";
  const now = Date.now();
  for (const [id, times] of recent) if (!times.some((t) => now - t < 600_000)) recent.delete(id);
  const times = (recent.get(key) ?? []).filter((t) => now - t < 600_000);
  if (inFlight.has(key) || inFlight.size >= 4 || times.length >= 8) return json({ error: "Đang xử lý hoặc đã vượt 8 lượt/10 phút. Vui lòng thử lại sau." }, 429);
  inFlight.add(key);
  try {
    // Bound actual bytes, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Yêu cầu trống." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) { await reader.cancel(); return json({ error: "File quá lớn. Giảm số trang hoặc dung lượng ảnh." }, 413); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return json({ error: "Dữ liệu JSON không hợp lệ." }, 400); }
    const parsed = worksheetRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Kiểm tra lại nội dung: tối đa 6 trang, 80 câu; chỉ nhận ảnh JPG/PNG/WebP." }, 400);
    recent.set(key, [...times, now]);
    const items = await processWorksheet(parsed.data);
    return json({ items });
  } catch {
    // Do not return provider errors, homework contents or credentials to clients/logs.
    return json({ error: "Chưa xử lý được bài tập. Kiểm tra cấu hình AI, thử ít trang hơn hoặc nhập câu thủ công." }, 502);
  } finally {
    inFlight.delete(key);
  }
}
