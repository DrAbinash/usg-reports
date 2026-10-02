import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldPullIncrementally } from "../src/lib/usg/careSync";

/**
 * The watermark bug this guards against: the Studio's clinical tables were
 * cleared while UsgSyncState.lastSyncAt survived, so every sync asked CARE for
 * "rows updated since <recent>" and got zero — a 200 OK with an empty worklist,
 * forever. An emptied Studio must not trust a watermark.
 */
describe("worklist sync watermark gate", () => {
  it("does a full pull on a first-ever sync (no watermark)", () => {
    expect(
      shouldPullIncrementally({ fullRequested: false, hasWatermark: false, localOrders: 0 }),
    ).toBe(false);
  });

  it("does a full pull with local orders but no watermark yet", () => {
    expect(
      shouldPullIncrementally({ fullRequested: false, hasWatermark: false, localOrders: 900 }),
    ).toBe(false);
  });

  it("uses the watermark when this Studio holds the orders it was built from", () => {
    expect(
      shouldPullIncrementally({ fullRequested: false, hasWatermark: true, localOrders: 41 }),
    ).toBe(true);
  });

  it("ignores a surviving watermark when every local order is gone", () => {
    expect(
      shouldPullIncrementally({ fullRequested: false, hasWatermark: true, localOrders: 0 }),
    ).toBe(false);
  });

  it("still honours an explicit full sync over a populated database", () => {
    expect(
      shouldPullIncrementally({ fullRequested: true, hasWatermark: true, localOrders: 41 }),
    ).toBe(false);
  });
});

describe("sync route wires the gate", () => {
  const route = readFileSync("src/app/api/usg/worklist/sync/route.ts", "utf8");

  it("counts locally stored orders before deciding to trust the watermark", () => {
    expect(route).toMatch(/db\.usgCareOrder\.count\(/);
    expect(route).toMatch(/shouldPullIncrementally\(\{/);
  });

  it("no longer trusts lastSyncAt on its own", () => {
    expect(route).not.toMatch(/if\s*\(\s*!fullSync\s*&&\s*priorSync\?\.lastSyncAt\s*\)/);
  });

  it("counts orders, not patients — a pulled-but-undrafted Studio stays incremental", () => {
    expect(route).not.toMatch(/db\.usgPatient\.count\(/);
  });
});
