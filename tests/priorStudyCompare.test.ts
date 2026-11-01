/**
 * Comparing a study with the patient's own previous one.
 *
 * The Δ panel (`UsgDiffPanel` + `computeDiff`) has existed since v5 and could
 * only ever be opened one way: press "Duplicate" on a report in the register,
 * which creates a follow-up draft and hands the composer the source report from
 * the duplicate endpoint. A doctor who starts a fresh study for a patient he has
 * seen before has the same question — what changed since last time — and had no
 * way to ask it, even though the composer already fetches that patient's prior
 * signed studies for the copy-forward buttons.
 *
 * So the compare is now one of those buttons. What this file pins:
 *  - the list rows the button is built from carry the four fields a diff needs
 *    (a column dropped from the list payload would leave the panel silently
 *    comparing against nothing, which is worse than not offering it);
 *  - those fields really do drive a diff, through the same code the panel runs;
 *  - the wiring is complete on both sides of every memo comparator — a prop that
 *    is passed but not compared is a button that renders and then never updates.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => {
  return { requireSession: async () => null, getActiveClinicId: async () => "default" };
});

import { GET as list } from "@/app/api/usg/reports/route";
import { db } from "@/lib/db";
import { computeDiff } from "@/lib/usg/diff";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import type { UsgComposerState } from "@/lib/usg/types";

async function fetchByName(patientName: string) {
  const url = new URL("http://localhost/api/usg/reports");
  url.searchParams.set("patientName", patientName);
  url.searchParams.set("status", "FINALIZED");
  url.searchParams.set("limit", "8");
  const res = await list(new NextRequest(url.toString(), { method: "GET" }));
  return (await res.json()).reports as Array<Record<string, unknown>>;
}

const PRIOR_STATE = {
  studyKey: "wa-male",
  organs: [
    {
      organ: "liver",
      pathology: "liver-fatty-g1",
      pathologies: ["liver-fatty-g1"],
      text: "",
      vars: { span: "13.5" },
    },
  ],
};

async function seedPrior(over: Record<string, unknown> = {}) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientAge: "34",
      patientSex: "M",
      referredBy: "Dr S M Roy",
      studyKey: "wa-male",
      studyTitle: "Real-time B-mode ultrasound of whole abdomen (male)",
      stateJson: JSON.stringify(PRIOR_STATE),
      findings: "LIVER: Enlarged, diffusely echogenic. Span 13.5 cm.",
      impression: "Grade I fatty liver.\nNo other abnormality.",
      status: "FINALIZED",
      serialNo: 5150,
      finalizedAt: new Date("2026-09-14T04:30:00Z"),
      scanDate: new Date("2026-09-14T04:30:00Z"),
      ...over,
    },
  });
}

beforeEach(async () => {
  await db.usgReportVersion.deleteMany();
  await db.usgReportImage.deleteMany();
  await db.usgAudit.deleteMany();
  await db.usgCareOrder.deleteMany();
  await db.usgReport.deleteMany();
});

describe("what a comparison is built from", () => {
  it("sends every field the diff needs on a prior row", async () => {
    await seedPrior();
    const [row] = await fetchByName("Sample Patientone");
    expect(row).toBeTruthy();
    // stateJson is the comparison, impression is the "was" side, serialNo and
    // scanDate are how he tells two prior studies apart, studyTitle says whether
    // the two studies even share organs to compare.
    for (const field of ["stateJson", "impression", "serialNo", "scanDate", "studyTitle", "studyKey"]) {
      expect(row, `the list row lost ${field}`).toHaveProperty(field);
    }
    expect(row.impression).toContain("Grade I fatty liver");
    expect(row.serialNo).toBe(5150);
  });

  it("only offers priors that are signed, have findings, and are not this report", async () => {
    await seedPrior();
    await seedPrior({ status: "DRAFT", serialNo: null, finalizedAt: null });
    await seedPrior({ stateJson: "{}", serialNo: 5151 });
    const rows = await fetchByName("Sample Patientone");
    // The endpoint answers with everything FINALIZED; the composer is the one
    // that insists a prior is worth comparing against.
    expect(rows.length).toBe(2);
    const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
    expect(composer).toMatch(/row\.status === "FINALIZED" && row\.stateJson && row\.id !== report\?\.id/);
  });
});

describe("a prior row drives the panel the same way a duplicated draft does", () => {
  it("shows the measurement that moved and the finding that is new", async () => {
    await seedPrior();
    const [row] = await fetchByName("Sample Patientone");
    const prev = JSON.parse(String(row.stateJson)) as UsgComposerState;

    // Today's draft: the span grew and the grade went up.
    const next = {
      studyKey: "wa-male",
      organs: [
        {
          organ: "liver",
          pathology: "liver-fatty-g2",
          pathologies: ["liver-fatty-g2"],
          text: "",
          vars: { span: "15.2" },
        },
      ],
      impressionOverride: "Grade II fatty liver with hepatomegaly.",
    } as unknown as UsgComposerState;

    const prevLines = String(row.impression).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const diff = computeDiff(prev, next, USG_PATHOLOGIES_ALL, prevLines);

    const span = diff.measurements.find((m) => m.token === "span");
    expect(span, "the span change is the point of a follow-up").toMatchObject({ from: "13.5", to: "15.2" });
    expect(diff.addedPathologies.map((p) => p.label)).toContain("Fatty Liver — Gr II");
    expect(diff.clearedPathologies.map((p) => p.label)).toContain("Fatty Liver — Gr I");
    expect(diff.impression).toMatchObject({
      from: ["Grade I fatty liver.", "No other abnormality."],
      to: ["Grade II fatty liver with hepatomegaly."],
    });
  });

  it("compares nothing at all when the prior has no saved findings", async () => {
    await seedPrior({ stateJson: "{}" });
    const [row] = await fetchByName("Sample Patientone");
    const diff = computeDiff(
      JSON.parse(String(row.stateJson)) as UsgComposerState,
      { studyKey: "wa-male", organs: [] } as unknown as UsgComposerState,
      USG_PATHOLOGIES_ALL,
      null,
    );
    expect(diff.measurements).toEqual([]);
    expect(diff.addedPathologies).toEqual([]);
  });
});

describe("the affordance is wired at both ends of every memo", () => {
  const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
  const zone = readFileSync("src/components/studio/usg/composer/ImpressionZone.tsx", "utf8");
  const toolbar = readFileSync("src/components/studio/usg/composer/ComposerToolbar.tsx", "utf8");
  const panel = readFileSync("src/components/studio/usg/UsgDiffPanel.tsx", "utf8");

  it("offers the compare beside the copy button, and only on a draft", () => {
    // The condition, not just the words: a label inside a branch that can never
    // run is a button nobody can press, and a text search cannot tell them apart.
    expect(zone).toMatch(/\{onComparePrior \? \(/);
    expect(zone).toMatch(/Compare with \{label\}/);
    expect(zone).toMatch(/onComparePrior\?: \(prior: PriorFinalizedRow\) => void/);
    // The whole prior-study row is inside the not-finalized, priors-exist block.
    expect(zone).toMatch(/!isFinal && priorFinalized\.length > 0/);
  });

  it("compares the prop it is given, in the comparator too", () => {
    expect(zone).toMatch(/a\.onComparePrior === b\.onComparePrior/);
    expect(composer).toMatch(/onComparePrior=\{compareWithPrior\}/);
    expect(composer).toMatch(/diffSource=\{shownDiffSource\}/);
    // Stable identities: an inline arrow here re-renders the toolbar on every
    // keystroke, and the memo comparators would then be doing nothing.
    expect(composer).toMatch(/const compareWithPrior = useCallback\(/);
    expect(composer).toMatch(/const clearPriorDiff = useCallback\(/);
  });

  it("only offers to stop when there is a local comparison to stop", () => {
    expect(composer).toMatch(/onDismissDiff=\{priorDiff \? clearPriorDiff : undefined\}/);
    expect(toolbar).toMatch(/a\.onDismissDiff === b\.onDismissDiff/);
    expect(toolbar).toMatch(/onDismiss=\{onDismissDiff\}/);
    expect(panel).toMatch(/\{onDismiss \? \(/);
    expect(panel).toMatch(/stop comparing/);
  });

  it("carries the prior's own text into the comparison, not an empty string", () => {
    // The panel's "was" side is the impression that was signed, and its left
    // column is the saved state. Forward either as a blank and the diff reports
    // "no changes" against a study that plainly had them.
    expect(composer).toMatch(/stateJson: p\.stateJson,/);
    expect(composer).toMatch(/impression: p\.impression \?\? ""/);
    expect(composer).toMatch(/serial: p\.serialNo != null \? formatUsgSerial\(p\.serialNo\) : undefined/);
  });

  it("does not print a unit next to a value that is not there", () => {
    // The panel renders "13.5 cm → cleared", not "cleared cm": a blank slot is
    // not a measurement, and the follow-up row is read in a hurry.
    expect(panel).toMatch(/\{m\.to \|\| "cleared"\}\{m\.to && m\.unit \? ` \$\{m\.unit\}` : ""\}/);
  });

  it("keeps the register's follow-up path intact", () => {
    // The duplicate flow still supplies the source; the local one only takes
    // precedence while it is set.
    expect(composer).toMatch(/const shownDiffSource = priorDiff \?\? diffSource \?\? null;/);
    const view = readFileSync("src/components/studio/usg/UsgStudioView.tsx", "utf8");
    expect(view).toMatch(/setDiffSource\(\{/);
    expect(view).toMatch(/diffSource=\{diffSource\}/);
  });
});
