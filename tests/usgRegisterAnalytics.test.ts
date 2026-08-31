/**
 * Register export + analytics tests (v5 phase 8).
 *
 * Register contract: finalized-only rows in serial order, CSV quoting is
 * RFC-4180 (commas and quotes in patient names), the printable page carries
 * the PC-PNDT discipline lines. Analytics: month buckets cover exactly the
 * requested window, drafts never count, pathology frequency reads the
 * composer state, referrers rank.
 */
import { describe, expect, it } from "vitest";
import { registerCsv, registerHtml, type RegisterRow } from "@/lib/usg/register";
import { computeAnalytics, type AnalyticsReport } from "@/lib/usg/analytics";

const rows: RegisterRow[] = [
  {
    serialNo: 1,
    scanDate: "2026-08-02T10:00:00.000Z",
    finalizedAt: "2026-08-02T11:00:00.000Z",
    patientName: "Rani, Devi",
    patientAge: "30",
    patientSex: "F",
    phone: "9431234567",
    studyTitle: "USG WHOLE ABDOMEN",
    referredBy: "Dr. Kumar",
  },
  {
    serialNo: 12,
    scanDate: null,
    finalizedAt: "2026-08-28T09:00:00.000Z",
    patientName: 'Baby "P" Singh',
    patientAge: "2",
    patientSex: "CHILD",
    phone: "",
    studyTitle: "USG CRANIUM",
    referredBy: "",
  },
];

describe("register CSV", () => {
  it("emits the header and one line per finalized report, in serial order", () => {
    const csv = registerCsv(rows);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"USG No","Scan date","Finalized on","Patient","Age","Sex","Phone","Study","Referred by"');
    expect(lines[1]).toContain('"USG-0001"');
    expect(lines[2]).toContain('"USG-0012"');
  });

  it("escapes commas and quotes in names (RFC-4180)", () => {
    const csv = registerCsv(rows);
    expect(csv).toContain('"Rani, Devi"');
    expect(csv).toContain('"Baby ""P"" Singh"');
  });

  it("formats dates and falls back to finalizedAt when scanDate is null", () => {
    const csv = registerCsv(rows);
    expect(csv).toContain("02 Aug 2026");
    expect(csv).toContain("28 Aug 2026");
    expect(csv).toContain('"Child"');
  });
});

describe("register HTML", () => {
  it("is a standalone printable page with the discipline lines", () => {
    const html = registerHtml(rows, { appTitle: "CARE USG Studio", hospitalName: "CARE Diagnostics", addressLine: "Main Road", phone: "12345" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("USG REGISTER");
    expect(html).toContain("USG-0001");
    expect(html).toContain("never renumbered");
    expect(html).toContain("CARE Diagnostics");
    expect(html).toContain("A4 landscape");
    expect(html).toContain("2 finalized reports");
  });

  it("escapes patient names in the HTML", () => {
    const html = registerHtml(rows, { appTitle: "T", hospitalName: "H", addressLine: "", phone: "" });
    expect(html).not.toContain('Baby "P" Singh');
    expect(html).toContain("Baby &quot;P&quot; Singh");
  });
});

function report(over: Partial<AnalyticsReport>): AnalyticsReport {
  return {
    studyKey: "wa-female",
    status: "FINALIZED",
    scanDate: null,
    createdAt: "2026-08-15T10:00:00.000Z",
    referredBy: "",
    stateJson: "{}",
    ...over,
  };
}

describe("computeAnalytics", () => {
  it("counts finalized only — drafts never appear", () => {
    const a = computeAnalytics(
      [
        report({}),
        report({ status: "DRAFT" }),
      ],
      1,
    );
    expect(a.totalFinalized).toBe(1);
    expect(a.totalDrafts).toBe(1);
    expect(a.byStudy).toHaveLength(1);
  });

  it("buckets months exactly over the requested window", () => {
    const a = computeAnalytics([report({})], 0, 6);
    expect(a.perMonth).toHaveLength(6);
    expect(a.perMonth.reduce((n, m) => n + m.count, 0)).toBe(1);
  });

  it("counts pathology selections from the composer state", () => {
    const state = JSON.stringify({
      studyKey: "wa-female",
      organs: [
        { organ: "liver", pathology: "liver-fatty-g1", pathologies: ["liver-fatty-g1"], custom: false, text: "x", vars: {} },
        { organ: "gb", pathology: null, pathologies: [], custom: false, text: "y", vars: {} },
      ],
      impressionOverride: null,
    });
    const a = computeAnalytics(
      [report({ stateJson: state }), report({ stateJson: state })],
      2,
      12,
      { "wa-female": "Whole Abdomen — Female" },
      { "liver-fatty-g1": "Fatty Liver — Gr I" },
    );
    expect(a.topPathologies[0]).toEqual({ key: "liver-fatty-g1", label: "Fatty Liver — Gr I", count: 2 });
    expect(a.byStudy[0].label).toBe("Whole Abdomen — Female");
  });

  it("ranks referrers and drops blanks", () => {
    const a = computeAnalytics(
      [
        report({ referredBy: "Dr. Kumar" }),
        report({ referredBy: "Dr. Kumar" }),
        report({ referredBy: "Dr. Sen" }),
        report({ referredBy: "   " }),
      ],
      2,
    );
    expect(a.topReferrers[0]).toEqual({ key: "Dr. Kumar", label: "Dr. Kumar", count: 2 });
    expect(a.topReferrers).toHaveLength(2);
  });

  it("survives corrupt stateJson without counting it", () => {
    const a = computeAnalytics([report({ stateJson: "{broken" })], 1);
    expect(a.topPathologies).toEqual([]);
  });

  it("uses scanDate (back-dated) for the month bucket when present", () => {
    const a = computeAnalytics([report({ scanDate: "2025-12-20T10:00:00.000Z" })], 1, 24);
    const dec = a.perMonth.find((m) => m.ym === "2025-12");
    expect(dec?.count).toBe(1);
  });
});
