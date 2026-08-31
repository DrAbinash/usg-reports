/**
 * CARE ERP bridge client tests.
 *
 * The CARE client itself was already wired correctly (verified on the
 * Synology: /api/internal/reporting-studio/ping answers 401 without a key).
 * These tests pin the contract so it cannot regress:
 *   - x-api-key header comes from SERVER-side saved settings
 *   - 401 is surfaced with status (and the ERP's own message when present)
 *   - not-configured / timeout / network-failure have distinct messages
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getSettings: mocks.getSettings }));

const { pingCare, fetchWorklist } = await import("@/lib/careClient");

const BASE = "http://172.16.1.139:8888";

type SettingsLike = { careApiBase: string; careApiKey: string };

function settings(over: Partial<SettingsLike> = {}): SettingsLike {
  return { careApiBase: BASE, careApiKey: "test-api-key-123", ...over };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("pingCare — happy path", () => {
  it("calls {base}/api/internal/reporting-studio/ping with the saved x-api-key", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ ok: true, version: "1.3.0" }));

    const r = await pingCare();

    expect(r.ok).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/internal/reporting-studio/ping`);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key-123");
    expect(headers["content-type"]).toBe("application/json");
  });

  it("strips trailing slashes (and whitespace) from a pasted base URL", async () => {
    mocks.getSettings.mockResolvedValue(settings({ careApiBase: `  ${BASE}/  ` }));
    vi.mocked(fetch).mockResolvedValue(json({ ok: true }));
    await pingCare();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/internal/reporting-studio/ping`);
  });
});

describe("pingCare — failure modes", () => {
  it("surfaces 401 with the ERP's own error message", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ error: "unauthorized" }, 401));

    const r = await pingCare();

    expect(r).toEqual({ ok: false, error: "CARE responded 401: unauthorized" });
  });

  it("surfaces a bare 401 when the body has no JSON message", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 401 }));
    const r = await pingCare();
    expect(r).toEqual({ ok: false, error: "CARE responded 401" });
  });

  it("says 'not configured' (no network call) when the base URL is missing", async () => {
    mocks.getSettings.mockResolvedValue(settings({ careApiBase: "" }));
    const r = await pingCare();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("CARE integration not configured");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("says 'not configured' (no network call) when the API key is missing", async () => {
    mocks.getSettings.mockResolvedValue(settings({ careApiKey: "" }));
    const r = await pingCare();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("CARE integration not configured");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("reports a timeout distinctly after 10s", async () => {
    vi.useFakeTimers();
    try {
      mocks.getSettings.mockResolvedValue(settings());
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

      const pending = pingCare();
      await vi.advanceTimersByTimeAsync(10_000);
      const r = await pending;

      expect(r).toEqual({ ok: false, error: "CARE timed out (10s)" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a plain network failure as 'CARE unreachable'", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
    const r = await pingCare();
    expect(r).toEqual({ ok: false, error: "CARE unreachable" });
  });

  it("explains when the base URL is not a valid http(s) URL", async () => {
    mocks.getSettings.mockResolvedValue(settings({ careApiBase: "172.16.1.139:8888" }));
    const r = await pingCare();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("must start with http:// or https://");
      expect(r.error).toContain("http://172.16.1.139:8888");
    }
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("other endpoints use the same auth + error plumbing", () => {
  it("fetchWorklist posts the same x-api-key and surfaces 409 verbatim", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ error: "Match Center: patient mismatch" }, 409));

    const r = await fetchWorklist();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("CARE responded 409: Match Center: patient mismatch");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key-123");
  });
});
