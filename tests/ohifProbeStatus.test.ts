/**
 * Guard: "answered" and "reached" are not the same fact as "authorised".
 *
 * Regression this pins: putting Cloudflare Access (or any edge auth) in front of
 * the clinic's OHIF made the studio's probe see a 401, report the viewer
 * "unreachable", and fall back to the plain-http LAN viewer — which an https
 * page cannot frame. Turning on authentication therefore looked like breaking
 * the viewer. An endpoint that answers is reachable; what it wants is a message.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { probeViewer } from "@/lib/usg/ohifResolver";

describe("probeViewer distinguishes a locked viewer from a dead one", () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const status of [401, 403]) {
    it(`treats ${status} as reachable but needing sign-in`, async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
      const r = await probeViewer("https://ohif.example", "Custom viewer");
      expect(r.reachable).toBe(true);
      expect(r.status).toBe(status);
      expect(r.error).toMatch(/is up but needs sign-in/);
    });
  }

  it("still calls a genuine server failure unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const r = await probeViewer("https://ohif.example", "Custom viewer");
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/responded 500/);
  });

  it("still calls no answer at all unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const r = await probeViewer("https://ohif.example", "Custom viewer");
    expect(r.reachable).toBe(false);
    expect(r.error).toMatch(/unreachable/);
  });
});
