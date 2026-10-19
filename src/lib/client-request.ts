export class ClientRequestError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

/** The signal also bounds subsequent response body reads. */
export function clientFetch(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const deadline = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
}

/** Deadline covers both the response headers and JSON body. Never retries writes. */
export async function clientJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  try {
    const response = await fetch(url, { cache: "no-store", ...init, signal });
    const data = await response.json();
    if (!response.ok) throw new ClientRequestError(data.error || `Yêu cầu thất bại (HTTP ${response.status}).`, response.status);
    return data as T;
  } catch (reason) {
    if (deadline.aborted) throw new ClientRequestError(init.method && init.method !== "GET"
      ? "Haneul chưa phản hồi trong thời gian cho phép. Thao tác có thể đã được lưu; kiểm tra trạng thái trước khi gửi lại."
      : "Haneul chưa phản hồi trong 15 giây. Kiểm tra mạng hoặc máy chủ; trạng thái gần nhất vẫn được giữ lại.");
    throw reason;
  }
}
