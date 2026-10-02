import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { worklistPullMode } from "../src/lib/usg/careSync";
import { worklistQueryPath } from "../src/lib/usg/careClient";

/**
 * The watermark bug this guards against: the Studio's clinical tables were
 * cleared while UsgSyncState.lastSyncAt survived, so every sync asked CARE for
 * "rows updated since <recent>" and got zero — a 200 OK with an empty worklist,
 * forever. An emptied Studio must not trust its watermark.
 */
describe("worklist sync watermark gate", () => {
  it("backfills on a first-ever sync (no watermark, no orders)", () => {
    expect(worklistPullMode({ fullRequested: false, hasWatermark: false, localOrders: 0 })).toBe(
      "backfill",
    );
  });

  it("backfills when orders exist but no watermark has been recorded yet", () => {
    expect(worklistPullMode({ fullRequested: false, hasWatermark: false, localOrders: 900 })).toBe(
      "backfill",
    );
  });

  it("uses the watermark when this Studio still holds the orders it was built from", () => {
    expect(worklistPullMode({ fullRequested: false, hasWatermark: true, localOrders: 41 })).toBe(
      "incremental",
    );
  });

  it("ignores a surviving watermark when every local order is gone", () => {
    expect(worklistPullMode({ fullRequested: false, hasWatermark: true, localOrders: 0 })).toBe(
      "backfill",
    );
  });

  it("still honours an explicit full sync over a populated database", () => {
    expect(worklistPullMode({ fullRequested: true, hasWatermark: true, localOrders: 41 })).toBe(
      "backfill",
    );
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

  it("keeps a surviving watermark off a full pull", () => {
    expect(worklistQueryPath({ full: true, since: "2026-10-02T00:00:00.000Z" })).not.toContain(
      "since=",
    );
  });

  it("sends only the watermark on an incremental pull", () => {
    const path = worklistQueryPath({ since: "2026-10-02T00:00:00.000Z" });
    expect(path).toContain("since=2026-10-02T00%3A00%3A00.000Z");
    expect(path).not.toContain("limit=");
  });
});

describe("sync route wires the gate", () => {
  const route = readFileSync("src/app/api/usg/worklist/sync/route.ts", "utf8");

  it("counts locally stored orders before deciding to trust the watermark", () => {
    expect(route).toMatch(/db\.usgCareOrder\.count\(/);
    expect(route).toMatch(/worklistPullMode\(\{/);
  });

  it("no longer trusts lastSyncAt on its own", () => {
    expect(route).not.toMatch(/if\s*\(\s*!fullSync\s*&&\s*priorSync\?\.lastSyncAt\s*\)/);
  });

  it("counts orders, not patients — a pulled-but-undrafted Studio stays incremental", () => {
    expect(route).not.toMatch(/db\.usgPatient\.count\(/);
  });
});
