/**
 * OHIF viewer reachability probe (server-side).
 *
 * Strategy: HEAD first (cheap, no body). Some front-ends/proxies reject HEAD
 * with 405/403/501 — in that case retry with GET and a short timeout. Any 2xx
 * from either verb counts as reachable. When the server DID answer, report
 * the status code; only collapse to "unreachable" for real network errors.
 */
export type ViewerProbe = { ok: true; message: string } | { ok: false; error: string };

const HEAD_TIMEOUT_MS = 8_000;
const GET_TIMEOUT_MS = 6_000;

async function fetchWithTimeout(url: string, method: "HEAD" | "GET", ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { method, signal: controller.signal, cache: "no-store", redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function networkError(e: unknown, label: string, ms: number): string {
  if (e instanceof Error && e.name === "AbortError") return `${label} timed out (${ms / 1000}s)`;
  if (e instanceof TypeError && /invalid url|failed to parse/i.test(e.message)) {
    return `${label} unreachable (invalid URL — must start with http:// or https://)`;
  }
  return `${label} unreachable`;
}

export async function probeViewer(rawUrl: string, label: string): Promise<ViewerProbe> {
  const url = rawUrl.trim();
  if (!url) return { ok: false, error: `${label} URL not set` };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: `${label} unreachable (URL must start with http:// or https://)` };
  }

  // 1. HEAD
  let head: Response;
  try {
    head = await fetchWithTimeout(url, "HEAD", HEAD_TIMEOUT_MS);
  } catch (e) {
    return { ok: false, error: networkError(e, label, HEAD_TIMEOUT_MS) };
  }
  if (head.ok) return { ok: true, message: `${label} reachable` };

  // 2. HEAD rejected as unsupported → GET fallback
  if (head.status === 403 || head.status === 405 || head.status === 501) {
    let get: Response;
    try {
      get = await fetchWithTimeout(url, "GET", GET_TIMEOUT_MS);
    } catch (e) {
      return { ok: false, error: networkError(e, label, GET_TIMEOUT_MS) };
    }
    if (get.ok) return { ok: true, message: `${label} reachable (HEAD not supported, GET ok)` };
    return { ok: false, error: `${label} responded ${get.status}` };
  }

  return { ok: false, error: `${label} responded ${head.status}` };
}
