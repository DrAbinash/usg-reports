/**
 * OHIF launch routing — the real AUTO reachability walk, manual overrides,
 * caching/failover, probe timeouts, and the mixed-content rule.
 *
 * The resolver is tested against a stubbed settings source and a stubbed
 * global fetch: routing is about which endpoint gets chosen, so the config and
 * the network answers are exactly what we want to control.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Cfg = {
  ohifMode: "auto" | "lan" | "tailscale" | "custom";
  ohifLanUrl: string;
  ohifTailscaleUrl: string;
  ohifCustomUrl: string;
};

const holder = vi.hoisted(() => ({
  current: {
    ohifMode: "auto",
    ohifLanUrl: "http://lan.test:3010",
    ohifTailscaleUrl: "",
    ohifCustomUrl: "",
  } as Cfg,
}));

vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({ ...holder.current }),
}));

import {
  invalidateOhifProbes,
  probeViewer,
  resolveOhifStatus,
  testOhif,
} from "@/lib/usg/ohifResolver";
import {
  buildOhifViewerUrl,
  buildOhifWorklistUrl,
  isEmbedSafe,
  ohifStudyPath,
  pickOhifEndpoint,
  type OhifStatus,
} from "@/lib/usg/ohifLaunch";

/** Every fetch call the resolver made, in order. */
let calls: string[] = [];

function respond(status: number): Response {
  return new Response(null, { status });
}

/** Answer table: exact URL → status. Unknown URLs "refuse the connection". */
function routeTable(table: Record<string, number | "hang">) {
  globalThis.fetch = vi.fn(async (input: unknown, init?: { signal?: AbortSignal }) => {
    const url = String(input).replace(/\/+$/, "").replace(/^HEAD /, "");
    calls.push(url);
    const outcome = table[url];
    if (outcome === undefined) {
      throw new TypeError("fetch failed");
    }
    if (outcome === "hang") {
      // Respect the abort signal so the caller's timeout is genuinely tested.
      return await new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        if (signal.aborted) return reject(abortError());
        signal.addEventListener("abort", () => reject(abortError()), { once: true });
      });
    }
    return respond(outcome);
  }) as unknown as typeof fetch;
}

function abortError(): Error {
  return Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
}

function setCfg(patch: Partial<Cfg>): void {
  holder.current = { ...holder.current, ...patch };
}

const LAN = "http://lan.test:3010";
const TS = "https://ohif.tail-test.ts.net";

beforeEach(() => {
  calls = [];
  invalidateOhifProbes();
  setCfg({
    ohifMode: "auto",
    ohifLanUrl: LAN,
    ohifTailscaleUrl: "",
    ohifCustomUrl: "",
  });
  // Keep probes quick; the timeout test lowers it further.
  process.env.OHIF_PROBE_TIMEOUT_MS = "400";
  process.env.OHIF_PROBE_GET_TIMEOUT_MS = "400";
  delete process.env.OHIF_PROBE_FAIL_CACHE_MS;
  delete process.env.OHIF_PROBE_CACHE_MS;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── AUTO is a reachability walk, not a scheme guess ────────────────────

describe("AUTO routing", () => {
  it("uses LAN when LAN is reachable — even on an HTTPS page", async () => {
    // The old behaviour sent every https page to Tailscale regardless of the
    // network. With Tailscale configured AND the LAN up, LAN must still win.
    routeTable({ [LAN]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS });

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("lan");
    expect(status.serverPick.url).toBe(LAN);
    expect(status.availability).toBe("available");
    // In-clinic viewing must not depend on the internet: TS was never touched.
    expect(calls).toEqual([LAN]);
  });

  it("fails over to Tailscale when LAN is unreachable", async () => {
    routeTable({ [TS]: 200 }); // LAN throws → unreachable
    setCfg({ ohifTailscaleUrl: TS });

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("tailscale");
    expect(status.serverPick.url).toBe(TS);
    expect(status.endpoints.find((e) => e.key === "lan")?.reachable).toBe(false);
    expect(calls).toEqual([LAN, TS]);
  });

  it("is unavailable when LAN is down and Tailscale is not configured", async () => {
    routeTable({});
    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBeNull();
    expect(status.availability).toBe("unavailable");
    expect(status.serverPick.reason).toMatch(/no configured viewer reachable/);
    // Only the configured candidate was probed.
    expect(calls).toEqual([LAN]);
  });

  it("skips a missing Tailscale candidate instead of treating it as a failure", async () => {
    routeTable({});
    const status = await resolveOhifStatus();
    const ts = status.endpoints.find((e) => e.key === "tailscale");
    expect(ts?.configured).toBe(false);
    expect(ts?.reachable).toBeNull();
    expect(ts?.error).toBe("not configured");
    // The reason must not claim Tailscale was tried and failed.
    expect(status.serverPick.reason).not.toMatch(/Tailscale/i);
  });

  it("orders AUTO as LAN → custom → Tailscale", async () => {
    const CUSTOM = "https://ohif.canonical.test";
    routeTable({ [CUSTOM]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS, ohifCustomUrl: CUSTOM }); // LAN left configured but down

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("custom");
    expect(status.endpoints.map((e) => e.key)).toEqual(["lan", "custom", "tailscale"]);
    // Custom answered, so Tailscale is skipped entirely.
    expect(calls).toEqual([LAN, CUSTOM]);
  });

  it("reports every candidate even when AUTO short-circuits on LAN", async () => {
    routeTable({ [LAN]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS });

    const status = await resolveOhifStatus();
    expect(status.endpoints).toHaveLength(3);
    const ts = status.endpoints.find((e) => e.key === "tailscale");
    expect(ts?.reachable).toBeNull();
    expect(ts?.error).toBe("not probed (AUTO already resolved)");
  });

  it("treats a HEAD-refusing viewer (405) as reachable via GET", async () => {
    // OHIF and many proxies answer HEAD with 405/403/501 — that is not an outage.
    let head = true;
    globalThis.fetch = vi.fn(async () => {
      const status = head ? 405 : 200;
      head = false;
      return respond(status);
    }) as unknown as typeof fetch;

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("lan");
    expect(status.availability).toBe("available");
  });

  it("reports an HTTP error status rather than a fake timeout", async () => {
    routeTable({ [LAN]: 500 });
    const status = await resolveOhifStatus();
    expect(status.endpoints.find((e) => e.key === "lan")?.error).toBe("LAN viewer responded 500");
  });
});

// ── Manual routes ──────────────────────────────────────────────────────

describe("manual routes", () => {
  it("forces LAN even when another endpoint is healthier", async () => {
    routeTable({ [LAN]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS, ohifMode: "lan" });

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("lan");
    expect(status.serverPick.reason).toMatch(/selected manually and reachable/);
    expect(calls).toEqual([LAN]);
  });

  it("forces Tailscale and never probes LAN", async () => {
    routeTable({ [LAN]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS, ohifMode: "tailscale" });

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("tailscale");
    expect(calls).toEqual([TS]);
  });

  it("says so when the manually selected endpoint is unreachable", async () => {
    routeTable({}); // everything refuses connection
    setCfg({ ohifTailscaleUrl: TS, ohifMode: "tailscale" });

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBe("tailscale");
    expect(status.serverPick.reason).toMatch(/selected manually but unreachable/);
    expect(status.availability).toBe("unavailable");
    expect(status.endpoints.find((e) => e.key === "tailscale")?.reachable).toBe(false);
  });

  it("flags a manual route whose endpoint was never configured", async () => {
    routeTable({ [LAN]: 200 });
    setCfg({ ohifMode: "tailscale" }); // no Tailscale URL

    const status = await resolveOhifStatus();
    expect(status.serverPick.key).toBeNull();
    expect(status.availability).toBe("unavailable");
    expect(status.serverPick.reason).toMatch(/is not configured/);
    // It must NOT silently fall back to the reachable LAN.
    expect(calls).toEqual([]);
  });

  it("honours a per-call route override over the saved mode", async () => {
    routeTable({ [LAN]: 200, [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS, ohifMode: "auto" });

    const status = await resolveOhifStatus({ routeOverride: "tailscale" });
    expect(status.mode).toBe("tailscale");
    expect(status.serverPick.key).toBe("tailscale");
  });
});

// ── Timeouts ───────────────────────────────────────────────────────────

describe("probe timeout", () => {
  it("gives up on an endpoint that never answers and falls over", async () => {
    process.env.OHIF_PROBE_TIMEOUT_MS = "60";
    process.env.OHIF_PROBE_GET_TIMEOUT_MS = "60";
    routeTable({ [LAN]: "hang", [TS]: 200 });
    setCfg({ ohifTailscaleUrl: TS });

    const started = Date.now();
    const status = await resolveOhifStatus();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(3_000); // must not block the workspace
    expect(status.endpoints.find((e) => e.key === "lan")?.error).toMatch(/timed out/);
    expect(status.serverPick.key).toBe("tailscale");
  });

  it("classifies an abort as a timeout, not as unreachable", async () => {
    process.env.OHIF_PROBE_TIMEOUT_MS = "40";
    routeTable({ [LAN]: "hang" });
    const r = await probeViewer(LAN, "LAN viewer");
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/timed out/);
  });

  it("rejects a non-http endpoint before touching the network", async () => {
    routeTable({});
    const r = await probeViewer("ftp://nope:21", "LAN viewer");
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/must start with http/);
    expect(calls).toEqual([]);
  });
});

// ── Caching + failover ─────────────────────────────────────────────────

describe("probe cache", () => {
  it("reuses a successful route without re-probing", async () => {
    routeTable({ [LAN]: 200 });

    const first = await resolveOhifStatus();
    expect(first.cached).toBe(false);
    expect(calls).toHaveLength(1);

    const second = await resolveOhifStatus();
    expect(second.serverPick.key).toBe("lan");
    // Still one probe — the second call was served from the cache.
    expect(calls).toHaveLength(1);
    expect(second.cached).toBe(true);
  });

  it("does not probe every render", async () => {
    routeTable({ [LAN]: 200 });
    await Promise.all([resolveOhifStatus(), resolveOhifStatus(), resolveOhifStatus()]);
    // Concurrent resolves share one in-flight probe.
    expect(calls).toHaveLength(1);
  });

  it("fails over once the cached endpoint goes away", async () => {
    setCfg({ ohifTailscaleUrl: TS });
    routeTable({ [LAN]: 200, [TS]: 200 });
    expect((await resolveOhifStatus()).serverPick.key).toBe("lan");

    // LAN dies. Inside the success TTL the cached route is still trusted…
    routeTable({ [TS]: 200 });
    expect((await resolveOhifStatus()).serverPick.key).toBe("lan");

    // …but an explicit re-check (settings saved / load failed) re-probes and
    // moves to Tailscale rather than keeping a dead route.
    const after = await resolveOhifStatus({ force: true });
    expect(after.serverPick.key).toBe("tailscale");
    expect(after.availability).toBe("available");
  });

  it("caches a failure briefly so a recovered viewer is retried automatically", async () => {
    setCfg({ ohifTailscaleUrl: TS });
    process.env.OHIF_PROBE_FAIL_CACHE_MS = "25";
    routeTable({});
    expect((await resolveOhifStatus()).availability).toBe("unavailable");

    await new Promise((r) => setTimeout(r, 40));
    routeTable({ [LAN]: 200, [TS]: 200 });
    expect((await resolveOhifStatus()).serverPick.key).toBe("lan");
    delete process.env.OHIF_PROBE_FAIL_CACHE_MS;
  });

  it("invalidates when the endpoint configuration changes", async () => {
    const MOVED = "http://lan.test:3011";
    routeTable({ [LAN]: 200, [MOVED]: 200 });
    await resolveOhifStatus();
    expect(calls).toEqual([LAN]);

    // A different URL is a different cache key — no stale reuse, no cross-talk.
    setCfg({ ohifLanUrl: MOVED });
    const status = await resolveOhifStatus();
    expect(status.serverPick.url).toBe(MOVED);
    expect(calls).toEqual([LAN, MOVED]);
  });

  it("invalidateOhifProbes() forces a fresh probe", async () => {
    routeTable({ [LAN]: 200 });
    await resolveOhifStatus();
    invalidateOhifProbes();
    await resolveOhifStatus();
    expect(calls).toHaveLength(2);
  });
});

// ── Test OHIF ──────────────────────────────────────────────────────────

describe("testOhif()", () => {
  it("reports each endpoint and where AUTO would route", async () => {
    setCfg({ ohifTailscaleUrl: TS });
    routeTable({ [LAN]: 200, [TS]: 200 });

    const r = await testOhif();
    expect(r.ok).toBe(true);
    expect(r.lan.ok).toBe(true);
    expect(r.tailscale.ok).toBe(true);
    expect(r.custom.configured).toBe(false);
    expect(r.custom.error).toBe("not configured");
    expect(r.selected.key).toBe("lan");
    expect(r.message).toContain("AUTO → LAN viewer");
    expect(r.available).toBe(true);
  });

  it("distinguishes 'not configured' from 'unreachable' for Tailscale", async () => {
    routeTable({});
    const r = await testOhif();
    expect(r.tailscale.configured).toBe(false);
    expect(r.message).toContain("Tailscale not configured");

    setCfg({ ohifTailscaleUrl: TS });
    const r2 = await testOhif();
    expect(r2.tailscale.configured).toBe(true);
    expect(r2.tailscale.ok).toBe(false);
    expect(r2.message).toContain("Tailscale unreachable");
  });

  it("is not ok when nothing reachable exists", async () => {
    routeTable({});
    const r = await testOhif();
    expect(r.ok).toBe(false);
    expect(r.available).toBe(false);
    expect(r.selected.key).toBeNull();
    expect(r.message).toContain("AUTO → none");
  });

  it("probes every candidate rather than short-circuiting", async () => {
    setCfg({ ohifTailscaleUrl: TS, ohifCustomUrl: "https://ohif.canonical.test" });
    routeTable({ [LAN]: 200, [TS]: 200, "https://ohif.canonical.test": 200 });
    calls = [];
    await testOhif();
    // Diagnostic test must tell the truth about ALL endpoints.
    expect(calls.filter((u) => u.includes("lan.test"))).toHaveLength(1);
    expect(calls.filter((u) => u.includes("canonical"))).toHaveLength(1);
    expect(calls.filter((u) => u.includes("ts.net"))).toHaveLength(1);
  });
});

// ── URL construction: OHIF route + StudyInstanceUID semantics ──────────

describe("viewer URL construction", () => {
  const UID = "1.2.840.113619.2.55.3.605011977.162.1754823";

  it("preserves the OHIF /viewer?StudyInstanceUIDs= contract exactly", () => {
    expect(buildOhifViewerUrl(LAN, UID)).toBe(`${LAN}/viewer?StudyInstanceUIDs=${UID}`);
  });

  it("strips a trailing slash so no double slash appears", () => {
    expect(buildOhifViewerUrl(`${LAN}/`, UID)).toBe(`${LAN}/viewer?StudyInstanceUIDs=${UID}`);
  });

  it("percent-encodes a UID without damaging it", () => {
    const tricky = "1.2.3.4^5&6=7";
    const url = buildOhifViewerUrl(LAN, tricky);
    expect(url).not.toContain("^");
    expect(url).toContain("StudyInstanceUIDs=1.2.3.4%5E5%266%3D7");
    expect(new URL(url).searchParams.get("StudyInstanceUIDs")).toBe(tricky);
  });

  it("keeps a same-origin base relative (so the proxy route works)", () => {
    expect(buildOhifViewerUrl("/ohif", UID)).toBe(`/ohif/viewer?StudyInstanceUIDs=${UID}`);
    expect(buildOhifWorklistUrl("/ohif")).toBe("/ohif/viewer");
    expect(ohifStudyPath(UID)).toBe(`/viewer?StudyInstanceUIDs=${UID}`);
  });

  it("returns empty rather than a URL with no host", () => {
    expect(buildOhifViewerUrl("", UID)).toBe("");
    expect(buildOhifWorklistUrl("")).toBe("");
  });
});

// ── Client-side selection: embed safety + route pick ───────────────────

function statusOf(overrides: Partial<OhifStatus> = {}): OhifStatus {
  return {
    mode: "auto",
    endpoints: [],
    serverPick: { key: null, url: "", reason: "" },
    availability: "unavailable",
    checkedAt: Date.now(),
    cached: false,
    ...overrides,
  };
}

describe("mixed-content safety", () => {
  it("refuses to embed an http LAN viewer in an https page", () => {
    expect(isEmbedSafe({ sameOrigin: false, secure: false }, "https:")).toBe(false);
  });

  it("allows http LAN on an http page (the plain-LAN deployment)", () => {
    expect(isEmbedSafe({ sameOrigin: false, secure: false }, "http:")).toBe(true);
  });

  it("allows any same-origin path regardless of page scheme", () => {
    expect(isEmbedSafe({ sameOrigin: true, secure: false }, "https:")).toBe(true);
  });

  it("allows an https Tailscale viewer from an https page", () => {
    expect(isEmbedSafe({ sameOrigin: false, secure: true }, "https:")).toBe(true);
  });

  it("AUTO on an https page skips the reachable-but-http LAN candidate", () => {
    const status = statusOf({
      endpoints: [
        { key: "lan", label: "LAN viewer", configured: true, url: LAN, sameOrigin: false, secure: false, reachable: true, probeBy: "server" },
        { key: "tailscale", label: "Tailscale viewer", configured: true, url: TS, sameOrigin: false, secure: true, reachable: true, probeBy: "server" },
        { key: "custom", label: "Custom viewer", configured: false, url: "", sameOrigin: false, secure: false, reachable: null, probeBy: "server" },
      ],
    });

    const pick = pickOhifEndpoint(status, "auto", "https:");
    expect(pick.endpoint?.key).toBe("tailscale");
    // …and explains itself instead of looking broken.
    expect(pick.blocked?.key).toBe("lan");

    // The same status on an http page uses the LAN viewer.
    expect(pickOhifEndpoint(status, "auto", "http:").endpoint?.key).toBe("lan");
  });

  it("prefers a same-origin custom endpoint over an http LAN one on https", () => {
    const status = statusOf({
      endpoints: [
        { key: "lan", label: "LAN viewer", configured: true, url: LAN, sameOrigin: false, secure: false, reachable: true, probeBy: "server" },
        { key: "custom", label: "Custom viewer", configured: true, url: "/ohif", sameOrigin: true, secure: false, reachable: true, probeBy: "browser" },
        { key: "tailscale", label: "Tailscale viewer", configured: false, url: "", sameOrigin: false, secure: true, reachable: null, probeBy: "server" },
      ],
    });
    expect(pickOhifEndpoint(status, "auto", "https:").endpoint?.url).toBe("/ohif");
  });

  it("keeps a manual route forced even when the browser could not embed it", () => {
    const status = statusOf({
      endpoints: [
        { key: "lan", label: "LAN viewer", configured: true, url: LAN, sameOrigin: false, secure: false, reachable: true, probeBy: "server" },
      ],
    });
    // The doctor explicitly chose LAN; we honour it and surface the state.
    const pick = pickOhifEndpoint(status, "lan", "https:");
    expect(pick.endpoint?.url).toBe(LAN);
  });

  it("returns nothing when no reachable candidate exists", () => {
    const status = statusOf({
      endpoints: [
        { key: "lan", label: "LAN viewer", configured: true, url: LAN, sameOrigin: false, secure: false, reachable: false, error: "unreachable", probeBy: "server" },
      ],
    });
    expect(pickOhifEndpoint(status, "auto", "http:").endpoint).toBeNull();
  });
});
