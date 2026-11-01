/**
 * "This patient already has a report for this study today."
 *
 * One patient scanned twice in a day is how a record splits in two: the worklist
 * idempotency is per CARE bill, so a second bill — or New Report pressed twice —
 * opens a second draft, and each one that gets signed takes its own register
 * number. Afterwards the history shows two reports for one study day and there
 * is no way to tell which carries the study.
 *
 * The answer is a warning in the composer that names the other report and opens
 * it, never a block: a repeat after a drain, or a KUB added to an abdomen, is
 * legitimate and only the doctor knows which case he is in.
 *
 * What these tests pin:
 *  - the match is same patient + same study + same clinic day, and each of those
 *    three conditions alone is not enough;
 *  - one name written two ways (CARE's "First Last", the scanner's "LAST^FIRST")
 *    is one patient, and an undated draft counts as today's work;
 *  - the route returns the other report with the words the banner shows, and
 *    never the draft being written;
 *  - the banner is actually rendered, and the memoised toolbar is told to
 *    re-render when the list changes.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { GET as sameDayGet } from "@/app/api/usg/reports/duplicates/route";
import { db } from "@/lib/db";
import { duplicateLabel, istDayWindow, sameDaySiblings, type DuplicateCandidate } from "@/lib/usg/duplicates";
import { clinicTodayIST } from "@/lib/usg/dates";

const DAY = "2026-11-01";
const row = (over: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
  id: "other-1",
  patientName: "Sample Patientone",
  studyKey: "wa-male",
  status: "DRAFT",
  serialNo: null,
  scanDate: "2026-11-01T06:30:00.000Z", // 12:00 IST — inside the clinic day
  createdAt: "2026-11-01T06:30:00.000Z",
  ...over,
});

const pick = (rows: DuplicateCandidate[], over: Partial<{ name: string; studyKey: string; day: string; excludeId: string | null }> = {}) =>
  sameDaySiblings(rows, { name: "Sample Patientone", studyKey: "wa-male", day: DAY, excludeId: null, ...over });

describe("the same-patient, same-day match", () => {
  it("finds the other report for the same patient, study and day", () => {
    expect(pick([row()]).map((r) => r.id)).toEqual(["other-1"]);
  });

  it("leaves a different study on the same day alone", () => {
    // One abdomen and one KUB on one morning is one patient, two legitimate scans.
    expect(pick([row({ studyKey: "kub" })])).toEqual([]);
  });

  it("leaves a different day alone", () => {
    expect(pick([row({ scanDate: "2026-10-31T06:30:00.000Z" })])).toEqual([]);
  });

  it("leaves a different patient alone — including a name that shares tokens", () => {
    expect(pick([row({ patientName: "Sample Patienttwo" })])).toEqual([]);
    expect(pick([row({ patientName: "Sample" })])).toEqual([]);
  });

  it("knows one name written two ways is one patient", () => {
    expect(pick([row({ patientName: "PATIENTONE^SAMPLE" })]).map((r) => r.id)).toEqual(["other-1"]);
    expect(pick([row({ patientName: "sample patientone " })]).map((r) => r.id)).toEqual(["other-1"]);
  });

  it("never reports the draft being written", () => {
    expect(pick([row()], { excludeId: "other-1" })).toEqual([]);
  });

  it("counts an undated draft as today's work, by when it was made", () => {
    expect(pick([row({ scanDate: null })]).map((r) => r.id)).toEqual(["other-1"]);
    expect(pick([row({ scanDate: null, createdAt: "2026-10-25T06:30:00.000Z" })])).toEqual([]);
  });

  it("reads the clinic day in IST, not the server's UTC date", () => {
    // 23:30 IST on 31 Oct is 18:00Z on 31 Oct; 00:30 IST on 1 Nov is 19:00Z on 31 Oct.
    const lateOct = row({ scanDate: "2026-10-31T18:00:00.000Z" }); // 23:30 IST 31 Oct
    const earlyNov = row({ id: "other-2", scanDate: "2026-10-31T19:00:00.000Z" }); // 00:30 IST 1 Nov
    expect(pick([lateOct])).toEqual([]);
    expect(pick([earlyNov]).map((r) => r.id)).toEqual(["other-2"]);
  });

  it("refuses a day it cannot read", () => {
    expect(istDayWindow("not-a-date")).toBeNull();
    expect(pick([row()], { day: "" })).toEqual([]);
    const w = istDayWindow(DAY);
    expect(w && w[1].getTime() - w[0].getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("says what the other report is: signed ones by register number, drafts as drafts", () => {
    expect(duplicateLabel(row())).toMatch(/^draft, 01 Nov 2026$/);
    expect(duplicateLabel(row({ status: "FINALIZED", serialNo: 7 }))).toMatch(/^register no\. 0007, 01 Nov 2026$/);
  });
});

// ---- the endpoint, against the test database
const get = async (params: Record<string, string>) => {
  const url = new URL("http://localhost/api/usg/reports/duplicates");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await sameDayGet(new NextRequest(url.toString(), { method: "GET" }));
  return { status: res.status, body: (await res.json()) as { reports: (DuplicateCandidate & { label: string })[] } };
};

async function seed(over: Record<string, unknown>) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientSex: "M",
      studyKey: "wa-male",
      stateJson: JSON.stringify({ studyKey: "wa-male", organs: [] }),
      scanDate: new Date(2026, 10, 1, 12, 0, 0), // local noon, the studio's own convention
      ...over,
    },
  });
}

describe("GET /api/usg/reports/duplicates", () => {
  beforeEach(async () => {
    await db.usgReportImage.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgReport.deleteMany();
  });

  it("answers with the other report and the words the banner shows", async () => {
    const mine = await seed({ id: "mine" });
    const twin = await seed({ id: "twin", status: "FINALIZED", serialNo: 42 });
    await seed({ id: "other-study", studyKey: "kub" });
    await seed({ id: "other-patient", patientName: "Sample Patienttwo" });
    await seed({ id: "other-day", scanDate: new Date(2026, 9, 25, 12, 0, 0) });

    const { status, body } = await get({
      patientName: "Sample Patientone",
      studyKey: "wa-male",
      scanDate: "2026-11-01",
      exclude: mine.id,
    });
    expect(status).toBe(200);
    expect(body.reports.map((r) => r.id)).toEqual([twin.id]);
    expect(body.reports[0].label).toMatch(/register no\. 0042/);
    expect(body.reports[0].patientName).toBe("Sample Patientone");
  });

  it("says nothing when there is nothing to say", async () => {
    const mine = await seed({ id: "alone" });
    const { body } = await get({
      patientName: "Sample Patientone",
      studyKey: "wa-male",
      scanDate: "2026-12-25",
      exclude: mine.id,
    });
    expect(body.reports).toEqual([]);
  });

  it("counts a follow-up draft the doctor never dated as today's work", async () => {
    // The scanDate column is null on such a draft, so only the created-at half of
    // the route's window can find it — the leg that a scan started and abandoned
    // this morning falls through.
    const twin = await seed({ id: "undated", scanDate: null });
    const { body } = await get({
      patientName: "Sample Patientone",
      studyKey: "wa-male",
      scanDate: clinicTodayIST(),
    });
    expect(body.reports.map((r) => r.id)).toEqual([twin.id]);
  });

  it("will not answer without a name, a study and a day", async () => {
    await seed({ id: "any" });
    expect((await get({ studyKey: "wa-male", scanDate: "2026-11-01" })).body.reports).toEqual([]);
    expect((await get({ patientName: "Sample Patientone", scanDate: "2026-11-01" })).body.reports).toEqual([]);
    expect((await get({ patientName: "Sample Patientone", studyKey: "wa-male" })).body.reports).toEqual([]);
  });

  it("stays inside the active clinic", async () => {
    await seed({ id: "elsewhere", clinicId: "other-clinic" });
    const { body } = await get({
      patientName: "Sample Patientone",
      studyKey: "wa-male",
      scanDate: "2026-11-01",
    });
    expect(body.reports).toEqual([]);
  });

  it("carries the follow-up draft into the clinic that made it", async () => {
    // The follow-up route used to leave clinicId out, so a duplicated report fell
    // to the schema default and was invisible to every clinic-scoped read — this
    // warning among them: the twin it exists to point at never appeared.
    const src = readFileSync("src/app/api/usg/reports/[id]/duplicate/route.ts", "utf8");
    expect(src).toMatch(/clinicId: source\.clinicId/);
  });
});

describe("the composer renders the warning it is given", () => {
  const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
  const toolbar = readFileSync("src/components/studio/usg/composer/ComposerToolbar.tsx", "utf8");

  it("asks per patient + study + day, and excludes itself", () => {
    expect(composer).toMatch(/"usg", "reports", "same-day", settledName\.trim\(\)\.toLowerCase\(\), studyKey, scanDate/);
    expect(composer).toMatch(/\/api\/usg\/reports\/duplicates/);
    expect(composer).toMatch(/\.\.\.\(report\?\.id \? \{ exclude: report\.id \} : \{\}\)/);
    // A signed report is not being written again — no reason to ask.
    expect(composer).toMatch(/enabled: settledName\.trim\(\)\.length >= 2 && !!scanDate && !isFinal/);
  });

  it("shows the banner, names the other report, and opens it on the click", () => {
    expect(toolbar).toMatch(/sameDay\.length > 0/);
    expect(toolbar).toMatch(/role="status"/);
    expect(toolbar).toMatch(/This patient already has a report for this study today/);
    expect(toolbar).toMatch(/\{r\.label\} — open/);
    expect(toolbar).toMatch(/onClick=\{\(\) => onOpenReport\(r\.id\)\}/);
    expect(composer).toMatch(/sameDay=\{sameDay\}/);
    expect(composer).toMatch(/onOpenReport=\{openComposerReport\}/);
    expect(composer).toMatch(/const openComposerReport = useStudio\(\(s\) => s\.openComposer\)/);
  });

  it("tells the memoised toolbar when the list changes", () => {
    // The trap this repo has hit before: the prop carried the data, the
    // comparator ignored it, and the banner never appeared.
    expect(toolbar).toMatch(/a\.sameDay === b\.sameDay/);
    expect(toolbar).toMatch(/a\.onOpenReport === b\.onOpenReport/);
    // and the empty case keeps one identity, or every keystroke re-renders it.
    expect(composer).toMatch(/const NO_SAME_DAY: SameDayReport\[\] = \[\]/);
    expect(composer).toMatch(/sameDayQ\.data\?\.reports \?\? NO_SAME_DAY/);
  });

  it("warns without holding the signature", () => {
    // Deliberate: the critical-finding gate refuses. A second scan is allowed,
    // because half the time it is the right thing to do.
    expect(composer).not.toMatch(/sameDay\.length && .*throw/);
    const finalize = readFileSync("src/app/api/usg/reports/[id]/finalize/route.ts", "utf8");
    expect(finalize).not.toMatch(/duplicates|sameDaySiblings/);
  });
});
