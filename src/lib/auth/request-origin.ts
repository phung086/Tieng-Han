/** Next's internal request URL can use 0.0.0.0 inside Docker. The browser's
 * destination is the Host header; never use untrusted forwarded-host values. */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const destination = new URL(request.url);
    const host = request.headers.get("host");
    if (host) {
      const addressed = new URL(`${destination.protocol}//${host}`);
      if (addressed.host.toLowerCase() !== host.toLowerCase() || addressed.username || addressed.password) return false;
      destination.host = addressed.host;
    }
    return origin === destination.origin;
  } catch { return false; }
}
