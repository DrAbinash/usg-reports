/**
 * Searching for a finding, not only for a word.
 *
 * The register's search box used to LIKE four columns — name, study, referrer,
 * impression. So "which patient" worked, "what did the impression say" mostly
 * worked, and nothing else did: a sentence that only appears in the body of the
 * report was invisible, and the chip the doctor actually clicked was
 * unsearchable. The chip matters most, because the wording it prints is editable
 * (normal overrides, per-clinic wording, custom findings) — so a text search can
 * miss the very report he tagged with the finding he is looking for.
 *
 * What these tests pin:
 *  - the words now include `findings`, the body of the report;
 *  - a finding is matched by its key, so a changed wording cannot hide it;
 *  - a query that is only one word stays a text search (typing "liver" must not
 *    be reinterpreted as a request for every hepatic finding in the archive);
 *  - grade II does not answer with grade I, and a report with no finding does
 *    not answer at all;
 *  - a malformed state row is skipped, not fatal, and never leaks another
 *    clinic's reports.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => {
  return { requireSession: async () => null, getActiveClinicId: async () => "default" };
});

import { GET as list } from "@/app/api/usg/reports/route";
import { db } from "@/lib/db";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { exactKeyOf, findingKeysForQuery, findingStateTokens } from "@/lib/usg/findingSearch";

describe("deciding what a query means", () => {
  it("reads a two-word finding out of prose", () => {
    expect(findingKeysForQuery("fatty gr ii", USG_PATHOLOGIES_ALL)).toContain("liver-fatty-g2");
    expect(findingKeysForQuery("fatty gr ii", USG_PATHOLOGIES_ALL)).not.toContain("liver-fatty-g1");
    expect(findingKeysForQuery("FATTY-LIVER-G1", USG_PATHOLOGIES_ALL)).toContain("liver-fatty-g1");
  });

  it("keeps a one-word query a text search", () => {
    // "liver" is what a doctor types when looking for a patient whose name he
    // half-remembers. Turning it into every hepatic finding in the archive would
    // answer a question nobody asked.
    expect(findingKeysForQuery("liver", USG_PATHOLOGIES_ALL)).toEqual([]);
    expect(findingKeysForQuery("", USG_PATHOLOGIES_ALL)).toEqual([]);
  });

  it("recognises a key typed or linked straight in", () => {
    expect(exactKeyOf("liver-fatty-g1", USG_PATHOLOGIES_ALL)).toBe("liver-fatty-g1");
    expect(exactKeyOf("fatty", USG_PATHOLOGIES_ALL)).toBeNull();
    expect(exactKeyOf("   ", USG_PATHOLOGIES_ALL)).toBeNull();
  });

  it("looks for a key inside the JSON quotes, not inside a word", () => {
    expect(findingStateTokens(["liver-fatty-g1"])).toEqual(['"liver-fatty-g1"']);
  });

  it("answers a two-word grade with every chip that prints that grade", () => {
    // `liver-fatty-g1-nosize` is a second way of tagging the same finding, and its
    // label reads "Fatty Gr I · no size". A doctor asking for grade I means both.
    const keys = findingKeysForQuery("fatty gr i", USG_PATHOLOGIES_ALL);
    expect(keys).toContain("liver-fatty-g1");
    expect(keys).toContain("liver-fatty-g1-nosize");
  });

  it("reaches a finding whose printed wording was rewritten, by its key", () => {
    // The wording behind a chip is editable (per-clinic wording, custom findings).
    // Once it is rewritten the prose no longer names the finding, so the stable
    // way in is the key — which is what an Insights click sends.
    const renamed = {
      ...USG_PATHOLOGIES_ALL.find((p) => p.key === "kidney-parenchymal")!,
      label: "Chronic Nephropathy",
    };
    expect(findingKeysForQuery("renal parenchymal", [renamed])).toEqual([]);
    expect(exactKeyOf("kidney-parenchymal", [renamed])).toBe("kidney-parenchymal");
  });
});

// ---- the register endpoint against the test database
async function search(params: Record<string, string>) {
  const url = new URL("http://localhost/api/usg/reports");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await list(new NextRequest(url.toString(), { method: "GET" }));
  const body = (await res.json()) as { reports: Array<Record<string, unknown>>; matchedFindings?: string[] };
  return body;
}

const withChips = (organ: string, key: string) =>
  JSON.stringify({ studyKey: "wa-male", organs: [{ organ, pathology: key, pathologies: [key], text: "" }] });

async function seed(over: Record<string, unknown>) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientSex: "M",
      studyKey: "wa-male",
      stateJson: JSON.stringify({ studyKey: "wa-male", organs: [] }),
      findings: "",
      impression: "No significant abnormality detected.",
      ...over,
    },
  });
}

describe("the register search", () => {
  beforeEach(async () => {
    await db.usgReportVersion.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgCareOrder.deleteMany();
    await db.usgReport.deleteMany();
  });

  it("finds a report by a sentence that only exists in the body", async () => {
    const only = await seed({
      findings: "LIVER: Coarse echotexture with periportal cuffing.",
      impression: "No significant abnormality detected.",
    });
    await seed({ findings: "LIVER: Normal study.", impression: "No significant abnormality detected." });

    const { reports } = await search({ q: "periportal cuffing" });
    expect(reports.map((r) => r.id)).toEqual([only.id]);
  });

  it("finds the report the chip was clicked on, whatever it now says", async () => {
    const g2 = await seed({
      stateJson: withChips("liver", "liver-fatty-g2"),
      findings: "LIVER: Enlarged, diffusely echogenic.",
      impression: "Hepatomegaly with fatty changes.",
    });
    const g1 = await seed({
      stateJson: withChips("liver", "liver-fatty-g1"),
      findings: "LIVER: Mildly echogenic.",
      impression: "Early fatty change.",
    });
    await seed({ impression: "No significant abnormality detected." });

    const byLabel = await search({ q: "fatty gr ii" });
    expect(byLabel.reports.map((r) => r.id)).toEqual([g2.id]);
    expect(byLabel.matchedFindings).toContain("liver-fatty-g2");

    // Neither of those rows mentions "fatty gr ii" as prose, so the only way this
    // returns grade I is by reading the key. The prose would have said
    // "Early fatty change" and hidden it.
    const byKey = await search({ q: "liver-fatty-g1" });
    expect(byKey.reports.map((r) => r.id)).toEqual([g1.id]);
  });

  it("still answers a patient's name", async () => {
    const a = await seed({ patientName: "Sample Patientone" });
    const b = await seed({ patientName: "Sample Patienttwo" });
    const { reports } = await search({ q: "Sample Patient" });
    expect(reports.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("is narrowed by status the same way it always was", async () => {
    const draft = await seed({ stateJson: withChips("liver", "liver-fatty-g2") });
    await seed({ stateJson: withChips("liver", "liver-fatty-g2"), status: "FINALIZED", serialNo: 4242 });
    const { reports } = await search({ q: "fatty gr ii", status: "DRAFT" });
    expect(reports.map((r) => r.id)).toEqual([draft.id]);
  });

  it("skips a report whose state will not parse, without taking the search down", async () => {
    await seed({ stateJson: "{ this is not json", findings: "KIDNEY: unparseable row", impression: "" });
    const good = await seed({
      stateJson: withChips("kidney", "kidney-calculus"),
      findings: "KIDNEY: Small echogenic focus with shadowing.",
      impression: "Renal calculus.",
    });
    // Two words, so this is a finding-key search — and the decision has to be
    // made row by row over a JSON column one row of which is not JSON at all.
    const { reports } = await search({ q: "renal calculus" });
    expect(reports.map((r) => r.id)).toEqual([good.id]);
  });

  it("never reaches into another clinic's findings", async () => {
    await seed({ clinicId: "other-clinic", stateJson: withChips("liver", "liver-fatty-g2") });
    const { reports } = await search({ q: "fatty gr ii" });
    expect(reports).toEqual([]);
  });

  it("escapes the wildcards a query can carry", async () => {
    await seed({ findings: "100% calcified stone" });
    const { reports } = await search({ q: "100%" });
    expect(reports.length).toBe(1);
    const none = await search({ q: "zz%qq" });
    expect(none.reports).toEqual([]);
  });

  it("draws the line at the closing quote when a key is asked for exactly", async () => {
    // Two chips whose keys are a prefix of each other. Pressing the bar for
    // `liver-fatty-g1` quotes a count of one key, so the `-nosize` variant's
    // reports must stay out of the answer even though its key contains every
    // word of the shorter one.
    const exact = await seed({
      status: "FINALIZED",
      serialNo: 4243,
      stateJson: withChips("liver", "liver-fatty-g1"),
    });
    await seed({
      status: "FINALIZED",
      serialNo: 4244,
      stateJson: withChips("liver", "liver-fatty-g1-nosize"),
    });
    const { reports, matchedFindings } = await search({ q: "liver-fatty-g1" });
    expect(reports.map((r) => r.id)).toEqual([exact.id]);
    expect(matchedFindings).toEqual(["liver-fatty-g1"]);
    // …and the words alone still reach both, which is what "fatty gr i" means.
    expect(findingKeysForQuery("fatty gr i", USG_PATHOLOGIES_ALL).length).toBeGreaterThan(1);
  });

  it("searches the body and the chips, and says so in the code", () => {
    const src = readFileSync("src/app/api/usg/reports/route.ts", "utf8");
    expect(src).toMatch(/"patientName", "studyTitle", "referredBy", "impression", "findings"/);
    expect(src).toMatch(/stateJson LIKE/);
    // the old four-column list must not come back
    expect(src).not.toMatch(/OR impression LIKE \$\{token\} ESCAPE \\\\/);
  });
});

/**
 * The half that decides whether any of the above is reachable.
 *
 * The SQL search has been in the endpoint since it was written, and no screen
 * ever used it: the register fetched the list once, then filtered the page it
 * already had in JavaScript (`UsgStudioView.tsx` at HEAD ended in
 * `r.patientName.toLowerCase().includes(q)`). So a query could only match what
 * had already been sent — never a body sentence, never a chip key, never a row
 * past the first 500. These guards fail if the register goes back to being a
 * client-side filter.
 */
describe("the register asks the server, and explains the answer", () => {
  const view = readFileSync("src/components/studio/usg/UsgStudioView.tsx", "utf8");

  it("sends the typed query as ?q=", () => {
    expect(view).toMatch(/if \(q\) params\.set\("q", q\)/);
  });

  it("does not re-filter the server's rows by the typed words", () => {
    // A report found by the chip it carries need not contain the words at all;
    // filtering it out here would undo the whole change.
    expect(view).toMatch(
      /const filtered = useMemo\(\s*\(\) => \(statusFilter \? reports\.filter\(\(r\) => r\.status === statusFilter\) : reports\)/,
    );
    expect(view).not.toMatch(/r\.patientName\.toLowerCase\(\)\.includes\(q\)/);
  });

  it("waits for the doctor to stop typing before asking", () => {
    expect(view).toMatch(/setTimeout\(\(\) => setSettledQuery\(query\.trim\(\)\), 300\)/);
  });

  it("names the finding the rows were matched on", () => {
    // Without this the list looks broken: rows appear for a query that is
    // nowhere in their text.
    expect(view).toMatch(/matchedFindings\.map\(\(k\) => \(\s*<span key=\{k\}/);
    expect(view).toMatch(/role="status"/);
  });

  it("says when nothing matched, instead of claiming there are no reports", () => {
    expect(view).toMatch(/Nothing matches “\{settledQuery\}”/);
    expect(view).toMatch(/Clear search/);
  });
});

/**
 * Insights counts, and a count nobody can open is a decoration. The click hands
 * the register the chip key — the label is editable prose, the key is the fact.
 */
describe("an Insights bar opens the reports behind its number", () => {
  const insights = readFileSync("src/components/studio/usg/UsgInsightsView.tsx", "utf8");
  const store = readFileSync("src/lib/store.ts", "utf8");
  const view = readFileSync("src/components/studio/usg/UsgStudioView.tsx", "utf8");

  it("sends the key, not the label", () => {
    expect(insights).toMatch(/openRegisterSearch\(p\.key\)/);
  });

  it("is wired at both ends", () => {
    // A field the producer sets and no reader consumes is an inert rule, and one
    // the register reads but nothing writes is dead the other way.
    expect(store).toMatch(/set\(\{ registerQuery: q, view: "usg" \}\)/);
    expect(store).toMatch(/registerQuery: null,/);
    expect(view).toMatch(/useStudio\(\(s\) => s\.registerQuery\)/);
    expect(view).toMatch(/setStatusFilter\("FINALIZED"\)/);
    expect(view).toMatch(/clearRegisterSearch\(\)/);
  });
});
