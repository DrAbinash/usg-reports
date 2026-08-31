/**
 * Orthanc REST client tests.
 *
 * Covers the 2026-08-30 production fix: the client must speak the real
 * Orthanc 1.12.x core REST API (/system, /studies, /studies/{id}) — there is
 * NO /api prefix — and must work anonymously when no username is configured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSettings: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getSettings: mocks.getSettings }));

const { listStudies, testOrthanc } = await import("@/lib/orthancClient");

const BASE = "http://172.16.1.139:8042";

type SettingsLike = {
  orthancUrl: string;
  orthancUsername: string;
  orthancPassword: string;
};

function settings(over: Partial<SettingsLike> = {}): SettingsLike {
  return { orthancUrl: BASE, orthancUsername: "", orthancPassword: "", ...over };
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

describe("testOrthanc — /system (no /api prefix)", () => {
  it("GETs {base}/system and parses Name/Version", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ Name: "Orthanc", Version: "1.12.5", DatabaseVersion: 6 }));

    const r = await testOrthanc();

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.Version).toBe("1.12.5");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`${BASE}/system`);
    expect(init?.method ?? "GET").toBe("GET"); // default verb, no /api/system
  });

  it("never calls /api/system", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ Name: "Orthanc", Version: "1.12.5" }));
    await testOrthanc();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("/api/");
  });

  it("surfaces HTTP status codes (e.g. 404) instead of 'unreachable'", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 404 }));
    const r = await testOrthanc();
    expect(r).toEqual({ ok: false, error: "Orthanc responded 404" });
  });

  it("reports 'not configured' without any network call when the URL is unset", async () => {
    mocks.getSettings.mockResolvedValue(settings({ orthancUrl: "" }));
    const r = await testOrthanc();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("not configured");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe("auth — anonymous Orthanc", () => {
  it("sends NO Authorization header when no username is configured", async () => {
    mocks.getSettings.mockResolvedValue(settings({ orthancUsername: "", orthancPassword: "" }));
    vi.mocked(fetch).mockResolvedValue(json({ Name: "Orthanc", Version: "1.12.5" }));

    await testOrthanc();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(Object.keys(headers)).not.toContain("Authorization");
  });

  it("sends Basic auth when a username is configured", async () => {
    mocks.getSettings.mockResolvedValue(settings({ orthancUsername: "orthanc", orthancPassword: "passw0rd" }));
    vi.mocked(fetch).mockResolvedValue(json({ Name: "Orthanc", Version: "1.12.5" }));

    await testOrthanc();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("orthanc:passw0rd").toString("base64")}`);
  });

  it("sends no Authorization for /studies either", async () => {
    mocks.getSettings.mockResolvedValue(settings({ orthancUsername: "", orthancPassword: "" }));
    vi.mocked(fetch).mockResolvedValue(json([]));
    await listStudies();
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    }
  });
});

describe("listStudies — /studies + /studies/{id} (two-step)", () => {
  const studyA = {
    ID: "aaa-111",
    MainDicomTags: { StudyInstanceUID: "1.2.840.1", AccessionNumber: "CARE-24081", StudyDate: "20260829", StudyDescription: "MRI BRAIN" },
  };
  const studyB = {
    ID: "bbb-222",
    MainDicomTags: { StudyInstanceUID: "1.2.840.2", AccessionNumber: "CARE-24082", StudyDate: "20260830", StudyDescription: "CT HEAD" },
  };

  it("lists IDs via /studies then fetches each study's MainDicomTags", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u === `${BASE}/studies`) return json([studyB.ID, studyA.ID]);
      if (u === `${BASE}/studies/${studyA.ID}`) return json(studyA);
      if (u === `${BASE}/studies/${studyB.ID}`) return json(studyB);
      return new Response("not found", { status: 404 });
    });

    const r = await listStudies();

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(2);
    const byId = Object.fromEntries(r.data.map((s) => [s.ID, s]));
    expect(byId[studyA.ID].MainDicomTags.AccessionNumber).toBe("CARE-24081");
    expect(byId[studyA.ID].MainDicomTags.StudyInstanceUID).toBe("1.2.840.1");
    expect(byId[studyB.ID].MainDicomTags.AccessionNumber).toBe("CARE-24082");
    // exactly 1 listing + 2 detail calls, and never a /api/ or DICOMweb path
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    for (const [u] of vi.mocked(fetch).mock.calls) {
      expect(String(u)).not.toContain("/api/");
    }
  });

  it("skips a study that fails to resolve instead of failing the whole sync", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u === `${BASE}/studies`) return json([studyA.ID, studyB.ID]);
      if (u === `${BASE}/studies/${studyA.ID}`) return json(studyA);
      return new Response("boom", { status: 500 });
    });

    const r = await listStudies();

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toHaveLength(1);
    expect(r.data[0].ID).toBe(studyA.ID);
  });

  it("handles an empty Orthanc (no studies) without detail calls", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json([]));
    const r = await listStudies();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-array /studies response instead of crashing", async () => {
    mocks.getSettings.mockResolvedValue(settings());
    vi.mocked(fetch).mockResolvedValue(json({ unexpected: true }));
    const r = await listStudies();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unexpected response");
  });
});

describe("URL hygiene", () => {
  it("trims whitespace/newlines around a pasted base URL", async () => {
    mocks.getSettings.mockResolvedValue(settings({ orthancUrl: `  ${BASE}/ \n` }));
    vi.mocked(fetch).mockResolvedValue(json({ Name: "Orthanc", Version: "1.12.5" }));

    await testOrthanc();

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(`${BASE}/system`);
  });

  it("distinguishes a timeout from a network failure", async () => {
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

      const pending = testOrthanc();
      await vi.advanceTimersByTimeAsync(10_000);
      const r = await pending;

      expect(r).toEqual({ ok: false, error: "Orthanc timed out (10s)" });
    } finally {
      vi.useRealTimers();
    }
  });
});
