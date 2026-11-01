/**
 * The signature-drift census.
 *
 * Until the draft-save fix (e4f1ee8) a save stored the findings and impression it
 * derived but not the composer state behind them, and finalize builds the signed
 * page from that state. So a report edited after its first save could be signed
 * from the earlier selections: the register's text and the printed page disagree,
 * and only the page was ever filed.
 *
 * `scripts/usg-signature-drift.mjs` counts how many signed reports in a database
 * still look like that. It is read-only, prints no patient name, and its whole
 * judgement rests on lifting the impression back out of a frozen page — so these
 * tests are what make the number trustworthy:
 *  - every template the studio can print is read back correctly;
 *  - a report finalized through the real route agrees with itself;
 *  - the mismatch the bug produced is actually flagged;
 *  - a page that printed no impression is not counted as a lost finding;
 *  - and the script cannot write, or name a patient on the console.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => {
  return {
    requireSession: async () => null,
    getActiveClinicId: async () => "default",
  };
});

import { POST as finalize } from "@/app/api/usg/reports/[id]/finalize/route";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildUsgReportHtml, toUsgPrintSettings } from "@/lib/usg/print";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import {
  audit, classify, explainFailure, extractPrintedImpression, normalizeImpression,
} from "../scripts/usg-signature-drift.mjs";

const SCRIPT = readFileSync("scripts/usg-signature-drift.mjs", "utf8");

const ALL_NORMAL_STATE = { studyKey: "wa-male", organs: [] };

/**
 * Render a page the way the studio does — through the real resolver, from a real
 * composer state. Handing buildUsgReportHtml an invented `resolved` object was
 * the first draft of this test; it dies on the fields the templates read
 * (`study.pcpndt`) and, if it survived, would test a page nobody prints.
 */
async function pageFor(template: string, state: unknown) {
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const overrides = await loadNormalOverrides();
  const normalised = normaliseState(state, "wa-male", overrides);
  const resolved = resolve(normalised, lookup, "Real-time B-mode abdominal sonography.", overrides);
  const print = { ...toUsgPrintSettings({ ...baseSettings, usgPrintStyle: template }), usgPrintStyle: template };
  const html = buildUsgReportHtml(
    print,
    { name: "Sample Patientone", age: "34", sex: "M", referredBy: "Dr S M Roy", date: "01 Nov 2026", serial: "USG-0001", provisional: false },
    resolved,
    [],
    null,
  );
  // The expectation is the resolver's own output, not a sentence typed into this
  // file: the census compares a page against what the studio says it should say.
  return { html, impression: resolved.impression.join("\n") };
}

let baseSettings: Record<string, unknown> = {};
beforeEach(async () => {
  baseSettings = await getSettings();
});

describe("reading the impression back out of a signed page", () => {
  const ABSCESS_STATE = {
    studyKey: "wa-male",
    organs: [{ organ: "liver", pathology: "liver-abscess", pathologies: ["liver-abscess"], text: "" }],
  };

  for (const template of ["classic", "premium", "premium_sidebar", "preprinted"]) {
    it(`reads it back from the ${template} page`, async () => {
      const { html, impression } = await pageFor(template, ABSCESS_STATE);
      const got = extractPrintedImpression(html);
      expect(got, `${template} produced no readable impression block`).not.toBeNull();
      expect(impression).toMatch(/abscess/i); // the state really does carry a finding
      expect(normalizeImpression(got)).toBe(normalizeImpression(impression));
    });
  }

  it("does not mistake the findings section for the impression", async () => {
    const { html, impression } = await pageFor("classic", ALL_NORMAL_STATE);
    const got = String(extractPrintedImpression(html));
    expect(got).toBe(impression);
    expect(got).toMatch(/No significant abnormality/);
    expect(got).not.toMatch(/morphology and parenchymal echogenicity/);
  });

  it("says a page has no impression rather than inventing one", () => {
    expect(extractPrintedImpression("<html><body>nothing here</body></html>")).toBeNull();
    expect(extractPrintedImpression("")).toBeNull();
  });
});

describe("the census over a real database", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  beforeEach(async () => {
    await db.usgReportVersion.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgCareOrder.deleteMany();
    await db.usgReport.deleteMany();
  });

  async function signed(state: unknown) {
    const report = await db.usgReport.create({
      data: {
        clinicId: "default",
        patientName: "Sample Patientone",
        patientSex: "M",
        studyKey: "wa-male",
        stateJson: JSON.stringify(state),
      },
    });
    const res = await finalize(new NextRequest(`http://localhost/api/usg/reports/${report.id}/finalize`, { method: "POST" }), ctx(report.id));
    await res.json();
    return db.usgReport.findUniqueOrThrow({ where: { id: report.id } });
  }

  const ALL_NORMAL = { studyKey: "wa-male", organs: [] };

  it("calls a report signed today consistent", async () => {
    const row = await signed(ALL_NORMAL);
    expect(classify(row).kind).toBe("agree");
  });

  it("flags the mismatch the old save produced", async () => {
    const row = await signed(ALL_NORMAL);
    expect(classify(row).kind).toBe("agree");

    // Exactly the shape of the defect: the register carries the words from the
    // last save, while the page was built from the state the save never stored.
    const tampered = { ...row, impression: "Hepatomegaly with a well defined hypoechoic lesion S/o Liver abscess." };
    expect(classify(tampered).kind).toBe("drift");

    const { counts, findings } = await audit(db);
    expect(counts.checked).toBe(1);
    expect(counts.agree).toBe(1); // the database itself still holds the true row
    expect(findings).toEqual([]);
  });

  it("lists a drifted report with both texts and its register number", async () => {
    const row = await signed(ALL_NORMAL);
    await db.usgReport.update({
      where: { id: row.id },
      data: { impression: "A finding that never reached the printed page." },
    });
    const { counts, findings } = await audit(db);
    expect(counts.drift).toBe(1);
    expect(findings.length).toBe(1);
    expect(findings[0].printed).toMatch(/No significant abnormality/);
    expect(findings[0].registerShows).toMatch(/never reached the printed page/);
    expect(findings[0].serialNo).toBe(row.serialNo);
    expect(findings[0].patientName).toBe("Sample Patientone");
  });

  it("runs as a command, counts the drifted report, and keeps the names in the file", async () => {
    const ok = await signed(ALL_NORMAL);
    const bad = await signed({
      studyKey: "wa-male",
      organs: [{ organ: "liver", pathology: "liver-abscess", pathologies: ["liver-abscess"], text: "" }],
    });
    // The old bug's footprint: the register's text moved while the page did not.
    await db.usgReport.update({
      where: { id: bad.id },
      data: { impression: "A finding the signed page never carried." },
    });

    const url = `file:${dbPath()}`;
    const child = spawnSync(process.execPath, ["scripts/usg-signature-drift.mjs"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: url },
      timeout: 120000,
    });
    const stdout = String(child.stdout ?? "");
    expect(child.status, `the census crashed: ${String(child.stderr).slice(-400)}`).toBe(0);
    expect(stdout).toMatch(/signed reports read\s+2/);
    expect(stdout).toMatch(/page disagrees\s+1/);
    expect(stdout).toMatch(/page agrees with record\s+1/);
    // the console is safe to paste into a bug report; the file is not
    expect(stdout).not.toContain("Sample Patientone");
    const tsv = readFileSync("tmp/signature-drift.tsv", "utf8");
    expect(tsv).toContain("Sample Patientone");
    expect(tsv).toContain("never carried");
    expect(ok.serialNo).not.toBe(bad.serialNo);
  });

  it("does not call an empty impression on the page a lost finding", () => {
    expect(classify({ reportHtml: "<p>no block</p>", impression: "   " }).kind).toBe("agree");
    expect(classify({ reportHtml: "<p>no block</p>", impression: "Something was found" }).kind).toBe("no-impression-on-page");
  });

  it("lists a page that printed no impression for a report that has one", async () => {
    const row = await signed(ALL_NORMAL);
    // A page from a template (or a hand-edited letterhead) that carries no
    // impression section at all: the register says something was found, the
    // paper says nothing. Not drift in the old-sense, but not nothing either.
    await db.usgReport.update({
      where: { id: row.id },
      data: { reportHtml: "<html><body><div class=letterhead>USG</div></body></html>" },
    });
    const { counts, findings } = await audit(db);
    expect(counts["no-impression-on-page"]).toBe(1);
    expect(findings.length).toBe(1);
    expect(findings[0].kind).toBe("no-impression-on-page");
    expect(findings[0].printed).toBe("");
  });

  it("reads the same words however each side chose to space them", () => {
    // The page breaks the impression over list items and lines; the column keeps
    // the resolver's own newlines. Without this the census would call every
    // multi-line report a mismatch and the number would be worthless.
    expect(normalizeImpression("  Acute Appendicitis.\n\n  Rest of the study is normal.  "))
      .toBe(normalizeImpression("Acute Appendicitis. Rest of the study is normal."));
    expect(normalizeImpression("A • B")).toBe(normalizeImpression("a b"));
    expect(normalizeImpression("A&b")).toBe("a&b");
  });
});

/** Absolute SQLite path for the database the tests are running against. */
function dbPath() {
  return join(process.cwd(), "tests", ".tmp", "test.db").replace(/\\/g, "/");
}

describe("the census script stays a census", () => {
  it("writes nothing to the database", () => {
    for (const verb of [".update(", ".delete(", ".deleteMany(", ".create(", "$executeRaw"]) {
      expect(SCRIPT, `the audit must never call ${verb}`).not.toContain(verb);
    }
    expect(SCRIPT).toContain("findMany");
  });

  it("keeps patient names off the console", () => {
    const logs = SCRIPT.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("console.log("))
      .join("\n");
    expect(logs).not.toContain("patientName");
    expect(logs).toContain("detail (contains patient names, keep it local)");
  });

  it("says what to check when it opened the wrong database", () => {
    // SQLite resolves a relative DATABASE_URL against the working directory, so
    // a path that works for `prisma` commands opens an empty database here and
    // answers "0 signed reports" about a clinic with hundreds.
    const e = new Error("Invalid `prisma.usgReport.findMany()` invocation:\nThe table `main.UsgReport` does not exist in the current database.");
    const said = explainFailure(e);
    expect(said).toMatch(/absolute file: path/);
    expect(said).toMatch(/volume1/);
    expect(explainFailure(new Error("database is locked"))).toMatch(/locked/);
  });

  it("is covered by the same composer state it reads", async () => {
    // loadAllPathologies/makeLookup exist where the audit's own comparison needs
    // no registry — it reads the page, not the state. Said here because the first
    // draft of this script re-resolved stateJson instead, which silently blamed
    // every report whose wording came from a normal-override.
    expect(SCRIPT).not.toContain("normaliseState");
    expect(typeof normaliseState).toBe("function");
    expect(typeof loadAllPathologies).toBe("function");
    expect(typeof makeLookup).toBe("function");
  });
});
