export class WorksheetBodyError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readWorksheetBody(request: Request, limit = 12_100_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new WorksheetBodyError("Chỉ nhận JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new WorksheetBodyError("Yêu cầu trống.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new WorksheetBodyError("Dữ liệu quá lớn.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new WorksheetBodyError("JSON không hợp lệ."); }
}
