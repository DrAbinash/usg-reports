/**
 * OHIF HTTP surface — /api/usg/ohif/status and the "Test OHIF" branch of
 * /api/settings/test. Route-level: these are what the viewer and Settings
 * actually call, so the query contract and the guard are what matters here.
 *
 * The CARE / Orthanc branches are asserted too: the OHIF card was added
 * alongside them and must not have disturbed either.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireSession = vi.fn();
const resolveOhifStatus = vi.fn();
const testOhif = vi.fn();
const pingCare = vi.fn();
const testOrthanc = vi.fn();
const invalidateOhifProbes = vi.fn();
const updateSettings = vi.fn();
const getMaskedSettings = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireSession: (...a: unknown[]) => requireSession(...a),
}));

vi.mock("@/lib/usg/ohifResolver", () => ({
  resolveOhifStatus: (...a: unknown[]) => resolveOhifStatus(...a),
  testOhif: (...a: unknown[]) => testOhif(...a),
  invalidateOhifProbes: (...a: unknown[]) => invalidateOhifProbes(...a),
}));

vi.mock("@/lib/usg/careClient", () => ({
  pingCare: (...a: unknown[]) => pingCare(...a),
}));

vi.mock("@/lib/usg/orthancClient", () => ({
  testOrthanc: (...a: unknown[]) => testOrthanc(...a),
}));

vi.mock("@/lib/settings", () => ({
  updateSettings: (...a: unknown[]) => updateSettings(...a),
  getMaskedSettings: async () => getMaskedSettings(),
}));

vi.mock("@/lib/usg/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/seed", () => ({ ensureSeed: vi.fn(async () => {}) }));

import { GET as STATUS_GET } from "@/app/api/usg/ohif/status/route";
import { POST as TEST_POST } from "@/app/api/settings/test/route";
import { PUT as SETTINGS_PUT } from "@/app/api/settings/route";

const unauthorized = async () => Response.json({ error: "unauthorized" }, { status: 401 });

function statusFixture(over: Record<string, unknown> = {}) {
  return {
    mode: "auto",
    endpoints: [
      { key: "lan", label: "LAN viewer", configured: true, url: "http://lan.test:3010", sameOrigin: false, secure: false, reachable: true, latencyMs: 4, probeBy: "server" },
      { key: "tailscale", label: "Tailscale viewer", configured: false, url: "", sameOrigin: false, secure: true, reachable: null, probeBy: "server" },
      { key: "custom", label: "Custom viewer", configured: true, url: "/ohif", sameOrigin: true, secure: false, reachable: null, probeBy: "browser" },
    ],
    serverPick: { key: "lan", url: "http://lan.test:3010", reason: "LAN viewer reachable" },
    availability: "available",
    checkedAt: 1,
    cached: false,
    ...over,
  };
}

beforeEach(() => {
  requireSession.mockReset();
  resolveOhifStatus.mockReset();
  testOhif.mockReset();
  pingCare.mockReset();
  testOrthanc.mockReset();
  invalidateOhifProbes.mockReset();
  updateSettings.mockReset();
  getMaskedSettings.mockReset();
  requireSession.mockResolvedValue(null);
  resolveOhifStatus.mockResolvedValue(statusFixture());
});

describe("GET /api/usg/ohif/status", () => {
  it("requires a session", async () => {
    requireSession.mockResolvedValue(await unauthorized());
    const res = await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status"));
    expect(res.status).toBe(401);
    expect(resolveOhifStatus).not.toHaveBeenCalled();
  });

  it("returns configuration and reachability only — no secrets, no credentials", async () => {
    const res = await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status"));
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/password|apiKey|pinHash|token/i);
    expect(body).toContain("LAN viewer");
  });

  it("exposes the flags the browser needs for mixed-content safety", async () => {
    const res = await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status"));
    const json = await res.json();
    const lan = json.endpoints.find((e: { key: string }) => e.key === "lan");
    const custom = json.endpoints.find((e: { key: string }) => e.key === "custom");
    expect(lan).toMatchObject({ secure: false, sameOrigin: false });
    expect(custom).toMatchObject({ sameOrigin: true, probeBy: "browser" });
  });

  it("?force=1 bypasses the reachability cache", async () => {
    await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status?force=1"));
    expect(resolveOhifStatus).toHaveBeenCalledWith({ force: true, routeOverride: undefined });
  });

  it("?route=<r> resolves a manual route server-side", async () => {
    await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status?route=tailscale"));
    expect(resolveOhifStatus).toHaveBeenCalledWith({ force: false, routeOverride: "tailscale" });
  });

  it("ignores an unknown route value instead of trusting the client", async () => {
    await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status?route=cloudflare"));
    expect(resolveOhifStatus).toHaveBeenCalledWith({ force: false, routeOverride: undefined });
  });

  it("accepts any legitimate mode including custom", async () => {
    await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status?route=custom&force=true"));
    expect(resolveOhifStatus).toHaveBeenCalledWith({ force: true, routeOverride: "custom" });
  });

  it("?page=https: makes AUTO judge embeddability for that page", async () => {
    await STATUS_GET(new NextRequest("http://localhost/api/usg/ohif/status?page=https:"));
    expect(resolveOhifStatus).toHaveBeenCalledWith({
      force: false,
      routeOverride: undefined,
      pageProtocol: "https:",
    });
  });

  it("any other ?page value stays reachability-only — the client cannot invent a filter", async () => {
    for (const value of ["http:", "", "ftp:", "https"]) {
      resolveOhifStatus.mockClear();
      await STATUS_GET(new NextRequest(`http://localhost/api/usg/ohif/status?page=${value}`));
      expect(resolveOhifStatus).toHaveBeenCalledWith({
        force: false,
        routeOverride: undefined,
        pageProtocol: undefined,
      });
    }
  });
});

describe("POST /api/settings/test — Test OHIF", () => {
  it("requires a session", async () => {
    requireSession.mockResolvedValue(await unauthorized());
    const res = await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "ohif" }), headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(401);
  });

  it("returns the per-endpoint OHIF report", async () => {
    testOhif.mockResolvedValue({
      ok: true, available: true, mode: "auto",
      lan: { ok: true, url: "http://lan.test:3010", latencyMs: 3 },
      tailscale: { ok: false, configured: false, url: "", error: "not configured" },
      custom: { ok: false, configured: false, url: "", error: "not configured" },
      selected: { key: "lan", url: "http://lan.test:3010", reason: "LAN viewer reachable" },
      message: "LAN reachable (3ms) · Tailscale not configured · AUTO → LAN viewer",
    });
    const res = await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "ohif" }), headers: { "content-type": "application/json" },
    }));
    const json = await res.json();
    expect(json.ohif.ok).toBe(true);
    expect(json.ohif.lan.ok).toBe(true);
    expect(json.ohif.tailscale.configured).toBe(false);
    expect(json.ohif.message).toContain("AUTO → LAN viewer");
    expect(testOhif).toHaveBeenCalledTimes(1);
  });

  it("does not touch CARE or Orthanc when testing OHIF", async () => {
    testOhif.mockResolvedValue({ ok: true });
    await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "ohif" }), headers: { "content-type": "application/json" },
    }));
    expect(pingCare).not.toHaveBeenCalled();
    expect(testOrthanc).not.toHaveBeenCalled();
  });

  it("leaves the CARE and Orthanc branches working exactly as before", async () => {
    pingCare.mockResolvedValue({ ok: true, data: { version: "1.2.3" } });
    testOrthanc.mockResolvedValue({ ok: true, data: { Version: "1.12.1" } });

    const careRes = await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "care" }), headers: { "content-type": "application/json" },
    }));
    expect(await careRes.json()).toEqual({ care: { ok: true, version: "1.2.3" } });
    expect(testOhif).not.toHaveBeenCalled();

    const orthancRes = await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "orthanc" }), headers: { "content-type": "application/json" },
    }));
    expect(await orthancRes.json()).toEqual({ orthanc: { ok: true, version: "1.12.1" } });
    expect(testOhif).not.toHaveBeenCalled();
  });

  it("tests all three under 'all'", async () => {
    pingCare.mockResolvedValue({ ok: false, error: "CARE down" });
    testOrthanc.mockResolvedValue({ ok: false, error: "Orthanc down" });
    testOhif.mockResolvedValue({ ok: false });
    const res = await TEST_POST(new NextRequest("http://localhost/api/settings/test", {
      method: "POST", body: JSON.stringify({ which: "all" }), headers: { "content-type": "application/json" },
    }));
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(["care", "ohif", "orthanc"]);
  });
});

describe("PUT /api/settings — OHIF cache invalidation", () => {
  it("drops the reachability cache when an OHIF setting is saved", async () => {
    updateSettings.mockResolvedValue(undefined);
    getMaskedSettings.mockResolvedValue({ ohifMode: "lan" });
    await SETTINGS_PUT(new NextRequest("http://localhost/api/settings", {
      method: "PUT", body: JSON.stringify({ ohifLanUrl: "http://lan.test:3010" }), headers: { "content-type": "application/json" },
    }));
    expect(invalidateOhifProbes).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate on unrelated settings", async () => {
    updateSettings.mockResolvedValue(undefined);
    getMaskedSettings.mockResolvedValue({});
    await SETTINGS_PUT(new NextRequest("http://localhost/api/settings", {
      method: "PUT", body: JSON.stringify({ hospitalName: "CARE" }), headers: { "content-type": "application/json" },
    }));
    expect(invalidateOhifProbes).not.toHaveBeenCalled();
  });
});
