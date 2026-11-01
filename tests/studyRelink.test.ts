/**
 * Acting on a guessed link.
 *
 * The sync marks rows whose images were inferred from a patient's name, and it
 * must be possible to disagree with it. Two things go wrong without these
 * guards: the mark becomes a warning label with no door behind it, and a
 * hand-picked study can belong to a different patient than the bill row.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { samePatientName } from "@/lib/usg/careSync";

const route = readFileSync("src/app/api/usg/worklist/[id]/link/route.ts", "utf8");
const view = readFileSync("src/components/studio/usg/UsgWorklistView.tsx", "utf8");
const sync = readFileSync("src/lib/usg/careSync.ts", "utf8");

describe("samePatientName", () => {
  it("reads CARE's order and the scanner's order as one person", () => {
    expect(samePatientName("Parween Alfi", "ALFI^PARWEEN")).toBe(true);
    expect(samePatientName(" Alfi   Parween ", "parween alfi")).toBe(true);
  });

  it("does not stretch to cover a different patient", () => {
    expect(samePatientName("Rani Devi", "Rani Kumari")).toBe(false);
    expect(samePatientName("Rani Devi", "Rani")).toBe(false);
  });

  it("refuses when either side has no name at all", () => {
    // An empty header name must never match an empty bill name: that is how a
    // blank links to a blank and two strangers swap pictures.
    expect(samePatientName("", "")).toBe(false);
    expect(samePatientName(null, "Alfi Parween")).toBe(false);
  });
});

describe("the link route", () => {
  it("is guarded on both handlers", () => {
    expect(route.match(/requireSession/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("re-reads the DICOM header and refuses a different patient name", () => {
    // A hand-pick is not a licence: the veto is the same comparison the guessed
    // link uses, and it happens server-side, after lookup, before any write.
    expect(route).toMatch(/lookupStudyByUid\(uid\)/);
    expect(route).toMatch(/if \(!samePatientName\(look\.tags\.PatientName, order\.patientName\)\) \{/);
    expect(route).toMatch(/status: 409/);
  });

  it("asks the PACS by UID through /tools/lookup, not a REST path", () => {
    // The older pacs-return check put a Study UID straight into
    // /studies/<uid>, which is always 404 because that path wants an Orthanc
    // internal id — so "not returned" was a permanent answer.
    expect(route).not.toMatch(/\/studies\/\$\{uid\}/);
    const client = readFileSync("src/lib/usg/orthancClient.ts", "utf8");
    expect(client).toMatch(/\/tools\/lookup/);
    expect(client).toMatch(/found: false, orthancOk: true/);
  });

  it("clearing a link is a distinct durable state, not a null", () => {
    expect(route).toMatch(/uidLinkedBy: "unlinked by doctor"/);
    // ...and the sync must leave it alone. Filtered in JS because SQL `not`
    // never matches NULL and would drop every never-linked row.
    expect(sync).toMatch(/r\.uidLinkedBy !== "unlinked by doctor"/);
  });

  it("will not guess a study onto a signed report", () => {
    // importCareRows freezes REPORTED rows, so a wrong guess there is forever.
    expect(sync).toMatch(/status: \{ notIn: \["REPORTED", "IGNORED"\] \}/);
  });
});

describe("the chip is a door, not a caption", () => {
  it("renders the inferred-images mark as a button that opens the picker", () => {
    expect(view).toMatch(/onRelink=\{setRelinkOrder\}/);
    expect(view).toMatch(/Images by name — change/);
    expect(view).toMatch(/Click to choose a different study/);
  });

  it("no longer promises a study picker that does not relink anything", () => {
    // UsgDicomPicker attaches images and OCR into a report; it never writes the
    // order's Study UID, so that sentence named a recovery that did not exist.
    expect(view).not.toContain("Open the study picker to change it");
  });
});
