/**
 * OHIF viewer reachability probe tests.
 *
 * Strategy under test: HEAD first; if the server rejects HEAD as unsupported
 * (403/405/501) fall back to GET with a short timeout; any 2xx is reachable;
 * HTTP answers are reported with their status code — only real network
 * errors collapse to "unreachable".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { probeViewer } = await import("@/lib/viewerClient");

const LAN = "http://172.16.1.139:3010";

function head(status: number): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HEAD first", () => {
  it("treats a 2xx HEAD as reachable without any GET", async () => {
    vi.mocked(fetch).mockResolvedValue(head(200));

    const r = await probeViewer(LAN, "LAN viewer");

    expect(r).toEqual({ ok: true, message: "LAN viewer reachable" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(LAN);
    expect(init?.method).toBe("HEAD");
  });

  it("accepts any 2xx (e.g. 204)", async () => {
    vi.mocked(fetch).mockResolvedValue(head(204));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r.ok).toBe(true);
  });
});

describe("GET fallback when HEAD is unsupported", () => {
  it("falls back to GET after 405 and reports success", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(head(405))
      .mockResolvedValueOnce(new Response("<html>OHIF</html>", { status: 200 }));

    const r = await probeViewer(LAN, "LAN viewer");

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message).toContain("HEAD not supported, GET ok");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const [url2, init2] = vi.mocked(fetch).mock.calls[1];
    expect(String(url2)).toBe(LAN);
    expect(init2?.method).toBe("GET");
  });

  it("falls back to GET after 403", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(head(403))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r.ok).toBe(true);
  });

  it("reports the GET status when the fallback also fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(head(405))
      .mockResolvedValueOnce(new Response("err", { status: 502 }));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r).toEqual({ ok: false, error: "LAN viewer responded 502" });
  });
});

describe("HTTP answers carry their status code (no generic 'unreachable')", () => {
  it("HEAD 404 → 'responded 404', no GET fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(head(404));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r).toEqual({ ok: false, error: "LAN viewer responded 404" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("HEAD 500 → 'responded 500', no GET fallback", async () => {
    vi.mocked(fetch).mockResolvedValue(head(500));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r).toEqual({ ok: false, error: "LAN viewer responded 500" });
  });
});

describe("network-level failures", () => {
  it("reports a timeout distinctly", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: unknown, init?: RequestInit) =>
            new Promise<Response>((_, reject) => {
              init?.signal?.addEventListener("abort", () => {
                const err = new Error("The operation was aborted");
                err.name = "AbortError";
                reject(err);
              });
            }),
        ),
      );

      const pending = probeViewer(LAN, "LAN viewer");
      await vi.advanceTimersByTimeAsync(8_000);
      const r = await pending;

      expect(r).toEqual({ ok: false, error: "LAN viewer timed out (8s)" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("says 'unreachable' only for real network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r).toEqual({ ok: false, error: "LAN viewer unreachable" });
  });

  it("explains when the URL has no scheme", async () => {
    const r = await probeViewer("172.16.1.139:3010", "LAN viewer");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("must start with http:// or https://");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects an empty URL with the label", async () => {
    const r = await probeViewer("   ", "Tailscale viewer");
    expect(r).toEqual({ ok: false, error: "Tailscale viewer URL not set" });
  });
});

describe("LAN / Tailscale labels are preserved", () => {
  it("labels LAN results", async () => {
    vi.mocked(fetch).mockResolvedValue(head(200));
    const r = await probeViewer(LAN, "LAN viewer");
    if (r.ok) expect(r.message).toContain("LAN viewer");
    else expect(r.error).toContain("LAN viewer");
  });

  it("labels Tailscale results", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("no", { status: 404 }));
    const r = await probeViewer("https://tail-123.ts.net", "Tailscale viewer");
    if (!r.ok) expect(r.error).toContain("Tailscale viewer");
  });
});
