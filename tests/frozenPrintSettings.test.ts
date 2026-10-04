/**
 * Guard: a finalized report downloads with the sheet it was signed with.
 *
 * Printing served the frozen reportHtml while the PDF route rebuilt the document
 * from live Settings, so changing the clinic font, paper size or logo silently
 * restyled every report already filed — two different documents under one
 * register number. Finalize now stores the whitelisted print settings alongside
 * the snapshot, and the PDF reads them back through this function.
 *
 * The two properties that matter are that a missing or unreadable snapshot falls
 * back rather than failing the download, and that the snapshot can only ever
 * carry printable identity — never a key, a PIN or a secret.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { frozenPrintSettingsOf, toUsgPrintSettings } from "@/lib/usg/print";

describe("frozenPrintSettingsOf", () => {
  it("returns null for a draft or a pre-snapshot row", () => {
    expect(frozenPrintSettingsOf(null)).toBeNull();
    expect(frozenPrintSettingsOf(undefined)).toBeNull();
    expect(frozenPrintSettingsOf("")).toBeNull();
  });

  it("returns null rather than throwing on a corrupt snapshot", () => {
    expect(frozenPrintSettingsOf("{not json")).toBeNull();
    expect(frozenPrintSettingsOf("null")).toBeNull();
    expect(frozenPrintSettingsOf('"a string"')).toBeNull();
    expect(frozenPrintSettingsOf("[1,2]")).toBeNull();
  });

  it("round-trips the layout dials that decide how the sheet looks", () => {
    const stored = JSON.stringify({
      ...toUsgPrintSettings({}),
      usgPrintPaper: "a5",
      usgPrintCompact: true,
      usgPrintBodyFit: "multi",
      usgPrintFontSize: 12,
      hospitalName: "CARE Diagnostics",
    });
    const frozen = frozenPrintSettingsOf(stored);
    expect(frozen).not.toBeNull();
    expect(frozen!.usgPrintPaper).toBe("a5");
    expect(frozen!.usgPrintCompact).toBe(true);
    expect(frozen!.usgPrintBodyFit).toBe("multi");
    expect(frozen!.usgPrintFontSize).toBe(12);
    expect(frozen!.hospitalName).toBe("CARE Diagnostics");
  });

  it("strips anything that is not printable identity, including secrets", () => {
    // A snapshot is attacker-/accident-tolerant: it is re-whitelisted on read,
    // so a stored key can never reach a rendered document.
    const polluted = JSON.stringify({
      hospitalName: "CARE Diagnostics",
      usgPrintPaper: "a4",
      careApiKey: "super-secret",
      orthancPassword: "hunter2",
      geminiApiKey: "sk-…",
      qrSecret: "abc123",
      pinHash: "salt:hash",
    });
    const frozen = frozenPrintSettingsOf(polluted)!;
    expect(frozen.hospitalName).toBe("CARE Diagnostics");
    expect(JSON.stringify(frozen)).not.toMatch(/super-secret|hunter2|sk-|abc123|salt:hash/);
    expect(Object.keys(frozen)).not.toContain("careApiKey");
    expect(Object.keys(frozen)).not.toContain("pinHash");
  });

  it("an empty snapshot still yields the defaults the renderer expects", () => {
    const frozen = frozenPrintSettingsOf(JSON.stringify({}))!;
    expect(frozen.usgPrintPaper).toBe("a4");
    expect(frozen.usgPrintStyle).toBe("premium");
  });
});

describe("finalize stores what printing rendered", () => {
  const src = readFileSync("src/app/api/usg/reports/[id]/finalize/route.ts", "utf8");

  it("writes the same object it built the HTML from", () => {
    expect(src).toMatch(/const printSettings = toUsgPrintSettings\(/);
    expect(src).toMatch(/buildUsgReportHtml\(\s*printSettings,/);
    expect(src).toMatch(/printSettingsJson: JSON\.stringify\(printSettings\)/);
  });
});
