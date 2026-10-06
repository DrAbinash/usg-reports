/**
 * The sync watermark is a promise that CARE has served everything that changed
 * up to a given instant. These tests hold that promise — they exist because it
 * was broken: measured 2026-10-06, four days of rejected `UsgCareOrder` writes
 * (a Prisma client lagging its schema) left the watermark advancing anyway, so
 * the bill-desk rows were served once, lost, and parked behind the cursor for
 * good. The Studio ended up holding 3 CARE orders against 1,381 Orthanc rows.
 */
import { describe, expect, it } from "vitest";
import {
  DEEP_PULL_INTERVAL_MS,
  DEEP_PULL_WINDOW_MS,
  MAX_CURSOR_HOLDS,
  ORPHAN_MAX_AGE_DAYS,
  istDayOfDate,
  nameDayKey,
  planCareCursor,
  planWorklistPull,
} from "@/lib/usg/careSync";
import { servedAtFromPayload } from "@/lib/usg/careClient";

const NOW = Date.parse("2026-10-06T10:00:00.000Z");
const WATERMARK = new Date(NOW - 60 * 60 * 1000);

describe("care sync watermark advance rules", () => {
  it("advances to CARE's clock, never the Studio's, when every row landed", () => {
    const careClock = NOW - 30 * 60 * 1000;
    const plan = planCareCursor({
      servedThroughAt: careClock,
      writeFailures: 0,
      holds: 0,
      nowMs: NOW,
    });
    expect(plan.action).toBe("advance");
    if (plan.action !== "advance") return;
    expect(plan.at.getTime()).toBe(careClock);
    expect(plan.holds).toBe(0);
  });

  it("holds the watermark when a served row failed to write", () => {
    const plan = planCareCursor({
      servedThroughAt: NOW,
      writeFailures: 4,
      holds: 0,
      nowMs: NOW,
    });
    expect(plan).toEqual({ action: "hold", holds: 1 });
  });

  it("keeps holding without counting past the cap", () => {
    const plan = planCareCursor({
      servedThroughAt: NOW,
      writeFailures: 4,
      holds: MAX_CURSOR_HOLDS,
      nowMs: NOW,
    });
    expect(plan.action).toBe("advance");
    if (plan.action !== "advance") return;
    expect(plan.gaveUpAfterHolds).toBe(true);
  });

  it("still advances an older build's cursor when CARE reported no clock", () => {
    const plan = planCareCursor({
      servedThroughAt: null,
      writeFailures: 0,
      holds: 0,
      nowMs: NOW,
    });
    expect(plan.action).toBe("advance");
    if (plan.action !== "advance") return;
    expect(plan.at.getTime()).toBe(NOW);
  });
});

describe("worklist pull window", () => {
  it("pages the whole backlog on a backfill instead of trusting a watermark", () => {
    expect(
      planWorklistPull({
        mode: "backfill",
        watermark: WATERMARK,
        bufferMs: 0,
        lastDeepPullAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ full: true, since: null, deep: true });
  });

  it("runs a repair pull when no deep pull has ever run", () => {
    const p = planWorklistPull({
      mode: "incremental",
      watermark: WATERMARK,
      bufferMs: 0,
      lastDeepPullAt: null,
      nowMs: NOW,
    });
    expect(p.deep).toBe(true);
    expect(p.full).toBe(false);
    expect(Date.parse(p.since!)).toBe(NOW - DEEP_PULL_WINDOW_MS);
  });

  it("runs a repair pull once the interval has passed", () => {
    const p = planWorklistPull({
      mode: "incremental",
      watermark: WATERMARK,
      bufferMs: 0,
      lastDeepPullAt: new Date(NOW - DEEP_PULL_INTERVAL_MS - 1000),
      nowMs: NOW,
    });
    expect(p.deep).toBe(true);
  });

  it("stays incremental while the repair pull is recent", () => {
    const p = planWorklistPull({
      mode: "incremental",
      watermark: WATERMARK,
      bufferMs: 2 * 60 * 1000,
      lastDeepPullAt: new Date(NOW - 60 * 60 * 1000),
      nowMs: NOW,
    });
    expect(p).toEqual({
      full: false,
      since: new Date(WATERMARK.getTime() - 2 * 60 * 1000).toISOString(),
      deep: false,
    });
  });
});

describe("the serve clock is read out of both ERP envelope shapes", () => {
  it("takes serverTime from the incremental envelope", () => {
    expect(servedAtFromPayload({ orders: [], serverTime: 1760000000000 })).toBe(1760000000000);
  });

  it("falls back to meta.syncedAt on the legacy envelope", () => {
    expect(servedAtFromPayload({ rows: [], meta: { syncedAt: "2026-10-06T10:00:00.000Z" } })).toBe(NOW);
  });

  it("returns null rather than inventing a clock", () => {
    expect(servedAtFromPayload([{ worklistId: "1" }])).toBeNull();
    expect(servedAtFromPayload({ rows: [] })).toBeNull();
  });
});

describe("same-patient-same-day key (the orphan dedup)", () => {
  it("ignores name token order, so CARE and DICOM agree", () => {
    const a = nameDayKey("Alfi Parween", "2026-10-06");
    const b = nameDayKey("PARWEEN  alfi", "2026-10-06");
    expect(a).toBe(b);
    expect(a).toBe("alfi parween|2026-10-06");
  });

  it("separates days, so a repeat scan is not treated as a duplicate", () => {
    expect(nameDayKey("Alfi Parween", "2026-10-06")).not.toBe(nameDayKey("Alfi Parween", "2026-10-05"));
  });

  it("refuses a key without a real date or without a name", () => {
    expect(nameDayKey("Alfi Parween", null)).toBeNull();
    expect(nameDayKey("", "2026-10-06")).toBeNull();
  });

  it("reads the clinic's calendar day, not the UTC one", () => {
    // 23:30 IST on the 6th is 18:00 UTC on the 6th; 00:30 IST on the 7th is
    // 19:00 UTC on the 6th and must not read as the 6th.
    expect(istDayOfDate(new Date("2026-10-06T19:00:00Z"))).toBe("2026-10-07");
    expect(istDayOfDate(new Date("2026-10-06T18:00:00Z"))).toBe("2026-10-06");
    expect(istDayOfDate(null)).toBeNull();
  });

  it("bounds the fallback to a few days, not the archive", () => {
    expect(ORPHAN_MAX_AGE_DAYS).toBeLessThanOrEqual(7);
  });
});
