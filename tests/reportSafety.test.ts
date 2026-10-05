/**
 * Guard: the signed register and patient identity are not negotiable.
 *
 * Pinned regressions, all of which shipped silently:
 *  - DELETE /api/usg/reports/[id] deleted FINALIZED reports even though the UI
 *    had a 409 branch promising it would not.
 *  - PACS return found the order by patientName, so two patients sharing a name
 *    sent the SR onto the wrong study — careSync.ts identifies orders by UID /
 *    accession / worklist / bill number and refuses name matching, so this
 *    route must not be the exception.
 *  - The lock screen printed the seeded demo PIN, and /api/auth/state only
 *    treated an EMPTY pinHash as "needs setup", so the setup screen could never
 *    be reached and a guessed PIN unlocked a machine holding patient records.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p: string): string => readFileSync(p, "utf8");

describe("a finalized report cannot be deleted", () => {
  const src = read("src/app/api/usg/reports/[id]/route.ts");
  const del = /export async function DELETE\([\s\S]*?\n\}/.exec(src);

  it("the handler exists and rejects FINALIZED with 409", () => {
    expect(del, "DELETE handler not found").toBeTruthy();
    expect(del![0]).toMatch(/status:\s*409/);
    expect(del![0]).toMatch(/existing\.status === "FINALIZED"/);
  });

  it("the UI's promise and the server's rule agree", () => {
    expect(read("src/components/studio/usg/UsgStudioView.tsx")).toMatch(/err\.status === 409/);
  });
});

describe("PACS return identifies the study, never the name", () => {
  const src = read("src/app/api/usg/reports/[id]/pacs-return/route.ts");

  it("does not look up a care order by patientName", () => {
    expect(src).not.toMatch(/where:\s*\{\s*patientName/);
  });

  it("looks it up by the report it belongs to", () => {
    expect(src).toMatch(/where:\s*\{\s*reportId:\s*report\.id\s*\}/);
  });

  it("refuses rather than guessing when no order is linked", () => {
    expect(src).toMatch(/not linked to a CARE order/);
  });
});

describe("the demo PIN cannot be the lock on patient records", () => {
  it("the lock screen does not print a PIN", () => {
    expect(read("src/components/studio/LockScreen.tsx")).not.toMatch(/Demo PIN/);
  });

  it("auth/state and auth/setup share one demo-PIN rule", () => {
    expect(read("src/lib/pinPolicy.ts")).toMatch(/verifyPin\(DEMO_PIN, pinHash\)/);
    expect(read("src/app/api/auth/state/route.ts")).toMatch(/isPinSetupOutstanding\(settings\.pinHash\)/);
    // The two routes once disagreed: state showed the setup screen for a
    // studio still on the demo PIN while setup refused to write over any PIN,
    // so nobody could get in or set a new one.
    expect(read("src/app/api/auth/setup/route.ts")).toMatch(/if \(!isPinSetupOutstanding\(s\.pinHash\)\)/);
  });

  it("the demo PIN lives in one place", () => {
    expect(read("src/lib/seed.ts")).toMatch(/export const DEMO_PIN = "123456"/);
  });
});

describe("a full clinic restore is not one click", () => {
  const src = read("src/components/studio/SettingsView.tsx");
  const restore = /const restoreBackup = async \(file: File\) => \{([\s\S]*?)\n  \};/.exec(src);

  it("asks before replacing patients, reports and images", () => {
    expect(restore, "restoreBackup not found").toBeTruthy();
    expect(restore![1]).toMatch(/usg-clinic-backup/);
    expect(restore![1]).toMatch(/window\.confirm/);
  });
});
