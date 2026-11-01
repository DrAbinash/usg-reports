/**
 * The worklist pull window (v6.22).
 *
 * This replaced a watermark, and these tests are the guard for the replacement.
 * The old design asked CARE for "everything changed since <stored instant>" and
 * moved that instant only when every row landed. Measured on this clinic
 * 2026-10-30: `P1008` socket timeouts rejected the tail of a 448-row pull, the
 * cursor held, and because the hold path also refused to stamp the repair pull's
 * own clock, every later cycle re-ran the heaviest possible pull and failed in
 * the same place. The watermark sat at `2026-10-11T19:44:32Z` for 18.5 days with
 * 19 orders refusing to land — the worklist showed "Self/Walk-in" for the whole
 * clinic while the sync answered HTTP 200.
 *
 * A window makes no promise to keep: each cycle re-reads the same few days and
 * upserts, so there is no cursor to fall behind and nothing to pin.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORPHAN_MAX_AGE_DAYS, ORTHANC_SWEEP_DAYS, planWorklistPull, SYNC_LOOKBACK_DAYS } from "../src/lib/usg/careSync";
import { worklistQueryPath } from "../src/lib/usg/careClient";

const NOW = Date.parse("2026-10-30T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("worklist pull window", () => {
  it("pages the whole backlog when the operator asks for ?full=1", () => {
    expect(planWorklistPull({ fullRequested: true, localOrders: 1400, nowMs: NOW })).toEqual({
      full: true,
      since: null,
    });
  });

  it("pages the whole backlog when this Studio holds no orders", () => {
    // The clinical tables were once cleared while the sync state survived. With
    // a window instead of a watermark an emptied Studio still asks for three
    // days, which cannot rebuild years of history — so an empty order table has
    // to force the backlog read.
    expect(planWorklistPull({ fullRequested: false, localOrders: 0, nowMs: NOW })).toEqual({
      full: true,
      since: null,
    });
  });

  it("asks for a fixed window of days, not for a stored instant", () => {
    expect(
      planWorklistPull({ fullRequested: false, localOrders: 41, nowMs: NOW }),
    ).toEqual({ full: false, since: new Date(NOW - SYNC_LOOKBACK_DAYS * DAY).toISOString() });
  });

  it("asks for the same window again on the next cycle", () => {
    // The point of the whole change: the request cannot depend on anything the
    // previous cycle wrote, because that is how a rejected row stopped the
    // backlog behind it. Two cycles 90 seconds apart differ only by the clock.
    const a = planWorklistPull({ fullRequested: false, localOrders: 41, nowMs: NOW });
    const b = planWorklistPull({ fullRequested: false, localOrders: 41, nowMs: NOW + 90_000 });
    expect(Date.parse(a.since!)).toBe(NOW - SYNC_LOOKBACK_DAYS * DAY);
    expect(Date.parse(b.since!)).toBe(NOW + 90_000 - SYNC_LOOKBACK_DAYS * DAY);
  });

  it("re-reads two weeks of CARE so a late bill still lands", () => {
    // The window is the only retry this design has: a row rejected by a timeout
    // or a restart is served again while it is still inside it. Widened from 3
    // days for the trial — at ~150 studies a day the extra read is page-sized,
    // and a fortnight of self-healing is what an outage weekend costs.
    expect(SYNC_LOOKBACK_DAYS).toBe(14);
    expect(SYNC_LOOKBACK_DAYS).toBeLessThanOrEqual(14);
  });

  it("keeps the PACS sweep at a week, because that read is the one that timed out", () => {
    // Widening this is NOT the same as widening the CARE window: the sweep is a
    // DICOMweb date-range query per cycle, and 14 days of it is what produced
    // "Orthanc DICOMweb timed out". The safety net follows it, not the ERP window.
    expect(ORTHANC_SWEEP_DAYS).toBeLessThanOrEqual(7);
    expect(ORPHAN_MAX_AGE_DAYS).toBeLessThanOrEqual(ORTHANC_SWEEP_DAYS);
  });

  it("carries the window through to the URL CARE is asked for", () => {
    // The two halves are pure but they are wired by hand in the route, and a
    // dropped `since` there would silently turn every cycle into a backlog
    // read — the heaviest pull, every five minutes, forever.
    const pull = planWorklistPull({ fullRequested: false, localOrders: 41, nowMs: NOW });
    const path = worklistQueryPath({ full: pull.full, since: pull.since });
    expect(path).toContain(
      `since=${encodeURIComponent(new Date(NOW - SYNC_LOOKBACK_DAYS * DAY).toISOString())}`,
    );
    expect(path).not.toContain("limit=");
  });

  it("bounds the Orthanc sweep to the same order of magnitude as the CARE window", () => {
    // The attach pass used to sweep 14 days while the import rule under it only
    // keeps a fallback row for 3, so most studies read every cycle were ones the
    // next step refused to act on — and that sweep was itself one of the things
    // that timed out.
    expect(ORTHANC_SWEEP_DAYS).toBeLessThanOrEqual(7);
  });
});

/**
 * The ERP's no-parameter legacy worklist is a hard 500-row cap with no
 * truncation flag, so a backfill asked that way comes back silently short.
 * `limit=` selects the paginated path (ORDER BY id ASC with a keyset cursor
 * the client follows) instead.
 */
describe("worklist query path", () => {
  it("asks for the paginated path on a full/backfill pull", () => {
    const path = worklistQueryPath({ full: true });
    expect(path).toContain("status=all");
    expect(path).toMatch(/limit=\d+/);
    expect(path).not.toContain("since=");
  });

  it("keeps a window out of a full pull", () => {
    expect(worklistQueryPath({ full: true, since: "2026-10-02T00:00:00.000Z" })).not.toContain(
      "since=",
    );
  });

  it("sends only the window on an ordinary pull", () => {
    const path = worklistQueryPath({ since: "2026-10-02T00:00:00.000Z" });
    expect(path).toContain("since=2026-10-02T00%3A00%3A00.000Z");
    expect(path).not.toContain("limit=");
  });

  it("sends neither when there is nothing to constrain", () => {
    expect(worklistQueryPath({})).toBe(
      "/api/internal/reporting-studio/worklist?status=all",
    );
  });
});

describe("sync route wires the window", () => {
  const route = readFileSync("src/app/api/usg/worklist/sync/route.ts", "utf8");

  it("counts stored orders before deciding between a window and a backlog read", () => {
    expect(route).toMatch(/db\.usgCareOrder\.count\(/);
    expect(route).toMatch(/planWorklistPull\(\{/);
  });

  it("never lets a stored instant decide what CARE is asked for", () => {
    expect(route).not.toMatch(/if\s*\(\s*!fullSync\s*&&\s*priorSync\?\.lastSyncAt\s*\)/);
    expect(route).not.toMatch(/since:\s*priorSync\?\.lastSyncAt/);
  });

  it("counts orders, not patients — a UsgPatient row only appears once a report is saved", () => {
    expect(route).not.toMatch(/db\.usgPatient\.count\(/);
  });

  it("has no cursor-hold path left in it", () => {
    expect(route).not.toMatch(/cursorPlan/);
    expect(route).not.toMatch(/planCareCursor/);
    expect(route).not.toMatch(/action === "advance"/);
  });

  it("pins the retired hold counter at 0 instead of dropping the column", () => {
    expect(route).toMatch(/cursorHoldCount: 0/);
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/cursorHoldCount\s+Int/);
  });

  it("keeps the PACS safety net visible and counted", () => {
    // Every scanned patient here IS billed in CARE, but the machine follows no
    // MWL and writes no accession, so a study reaches the list only through
    // CARE's bridge. When CARE cannot answer, importOrthancOrphans is what keeps
    // the patient reportable — silently dropping it (which I did once) removes
    // the outage insurance, it does not remove the flood. What keeps the flood
    // from returning is the bounded window, the demographic suppression of a
    // second row, and the count being reported every cycle.
    expect(route).toMatch(/importOrthancOrphans\(/);
    expect(route).toMatch(/attachOrthancStudies\(/);
    expect(route).toMatch(/imported=\$\{orphanStats\.importedFromOrthanc\}/);
  });

  it("writes lastSyncAt as a clock, not as a gate", () => {
    expect(route).toMatch(/lastSyncAt: completedAt/);
    expect(route).not.toMatch(/lastSyncAt:\s*(cursorPlan|nextSyncAt|nextDeepPullAt)/);
  });
});
