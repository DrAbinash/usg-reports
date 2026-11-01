/**
 * Finding search in the composer.
 *
 * 258 findings, a dozen organs, six chips visible per row and the rest behind
 * "+N more" — so reaching a finding meant knowing which card it lives on. These
 * tests pin what the search answers, what it refuses to answer, and the one rule
 * that decides whether it works at all on a real study: which findings an organ
 * "has" is the app's own mapping, not a key comparison.
 *
 * Most of these run against the live catalog and the live study definitions,
 * because every one of those expectations was measured, not assumed: the female
 * abdomen's kidney cards are `kidney_rt`/`kidney_lt` while the chips are authored
 * on `kidney`, and a hand-made fixture would have passed either way.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { getStudy } from "@/lib/usg/studies";
import { searchChips, type ChipSearchOrgan } from "@/lib/usg/chipSearch";
import type { UsgPathologyDef } from "@/lib/usg/types";

const organsOf = (key: string): ChipSearchOrgan[] =>
  (getStudy(key)?.organs ?? []).map((o) => ({ key: o.key, label: o.label }));

const WA_FEMALE = organsOf("wa-female");
const keys = (q: string, study = "wa-female") =>
  searchChips(q, USG_PATHOLOGIES_ALL, organsOf(study)).map((h) => h.pathology.key);
const hit = (q: string, key: string, study = "wa-female") =>
  searchChips(q, USG_PATHOLOGIES_ALL, organsOf(study)).find((h) => h.pathology.key === key);

describe("the catalog is really this big", () => {
  it("has the chips the tests claim to search", () => {
    expect(USG_PATHOLOGIES_ALL.length).toBeGreaterThan(200);
    expect(WA_FEMALE.length).toBeGreaterThan(8);
    // The rule this whole file depends on: no kidney card is called "kidney".
    expect(WA_FEMALE.map((o) => o.key)).not.toContain("kidney");
    expect(USG_PATHOLOGIES_ALL.some((p) => p.organ === "kidney" && p.key === "kidney-calculus")).toBe(true);
  });
});

describe("what a query answers", () => {
  it("gives grade II for grade II, and not grade I as well", () => {
    const found = searchChips("fatty gr ii", USG_PATHOLOGIES_ALL, WA_FEMALE);
    expect(found.map((h) => h.pathology.key).sort()).toEqual(["liver-fatty-g2", "liver-fatty-g2-nosize"]);
    for (const h of found) expect(h.score).toBe(3);
  });

  it("reaches a chip by the words the doctor says, not the words the catalog wrote", () => {
    // The chip is "GB Calculus" on a card labelled "G. B"; the chip for the
    // kidney is "Renal Calculus" on a card labelled "RT KIDNEY".
    expect(hit("gall stone", "gb-calculus")).toMatchObject({ score: 3, organKey: "gb" });
    expect(hit("kidney stone", "kidney-calculus")?.score).toBe(3);
  });

  it("forgives one wrong letter", () => {
    expect(hit("calclus", "cbd-calculus")).toMatchObject({ score: 1, organKey: "cbd" });
    expect(keys("calclus").length).toBeGreaterThan(5);
  });

  it("finds a finding that sits on the shared OTHERS card", () => {
    expect(hit("ascites mild", "others-ascites-mild")?.organKey).toBe("others");
  });
});

describe("what it refuses to answer", () => {
  it("says nothing when the box is empty, or nearly", () => {
    expect(searchChips("", USG_PATHOLOGIES_ALL, WA_FEMALE)).toEqual([]);
    expect(searchChips("   ", USG_PATHOLOGIES_ALL, WA_FEMALE)).toEqual([]);
    expect(searchChips("zzzqqqxxx", USG_PATHOLOGIES_ALL, WA_FEMALE)).toEqual([]);
  });

  it("does not turn scattered letters into a finding", () => {
    // An earlier rule let a query's letters appear anywhere in the finding. It
    // answered "prostate" with "CHPS (Pyloric Stenosis)", which nobody asked for
    // and which a doctor would have had to learn not to trust.
    expect(keys("kdl")).toEqual([]);
    expect(keys("prostate")).toEqual([]);
    expect(keys("pericardial")).toEqual([]);
  });

  it("keeps findings of organs this study has no card for out of the results", () => {
    expect(USG_PATHOLOGIES_ALL.some((p) => p.organ === "prostate")).toBe(true);
    expect(keys("prostatomegaly", "wa-male").length).toBeGreaterThan(0);
    expect(keys("prostatomegaly", "wa-female")).toEqual([]);
  });

  it("never offers a clinic snippet as a finding", () => {
    // Not a special case in the search: snippets are authored on `_impression`
    // and `_advice`, and no organ card of any study maps to those — the same
    // rule that decides where a real chip may be clicked also excludes them.
    const snippets = [
      { key: "custom-x", organ: "_impression", label: "Impression snippet about stones", text: "", impression: [] },
      { key: "custom-y", organ: "_advice", label: "Advice snippet about stones", text: "", impression: [] },
    ] as unknown as UsgPathologyDef[];
    expect(searchChips("stones", snippets, WA_FEMALE)).toEqual([]);
    expect(searchChips("stones", [...snippets, ...USG_PATHOLOGIES_ALL], WA_FEMALE).some((h) => h.pathology.key.startsWith("custom-"))).toBe(false);
  });

  it("caps the list rather than covering the screen", () => {
    expect(searchChips("calculus", USG_PATHOLOGIES_ALL, WA_FEMALE, { limit: 3 }).length).toBe(3);
    expect(searchChips("liver", USG_PATHOLOGIES_ALL, WA_FEMALE).length).toBeLessThanOrEqual(12);
  });
});

describe("a result is always pressable, and lands where he is writing", () => {
  it("offers a kidney chip on a kidney card, not on the catalog's organ", () => {
    const found = hit("renal calculus", "kidney-calculus");
    expect(["kidney_rt", "kidney_lt"]).toContain(found?.organKey);
    expect(found?.organKey).not.toBe("kidney");
  });

  it("lands on the card he is on when two share the chip", () => {
    const left = searchChips("renal calculus", USG_PATHOLOGIES_ALL, WA_FEMALE, { preferredOrganKey: "kidney_lt" });
    const plain = searchChips("renal calculus", USG_PATHOLOGIES_ALL, WA_FEMALE);
    expect(left[0].organKey).toBe("kidney_lt");
    expect(plain[0].organKey).toBe("kidney_rt");
    // One offer per chip, not one per card.
    expect(new Set(left.map((h) => h.pathology.key)).size).toBe(left.length);
  });

  it("returns the sure matches before the lucky ones", () => {
    // Every token has to land on the same chip, so a query's results are ranked
    // against each other, not mixed within one finding: whatever comes back, the
    // scores only ever go down the list.
    for (const q of ["fatty gr ii", "calclus", "spleen", "ascites", "liver", "cyst", "stone"]) {
      const scores = searchChips(q, USG_PATHOLOGIES_ALL, WA_FEMALE).map((h) => h.score);
      expect(scores, `"${q}" came back out of order`).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it("settles a tie by the catalog's own chip order", () => {
    const sure = searchChips("calculus", USG_PATHOLOGIES_ALL, WA_FEMALE, { limit: 50 })
      .filter((h) => h.score === 3)
      .map((h) => h.pathology.key);
    expect(sure.length).toBeGreaterThan(2);
    const flipped = searchChips("calculus", USG_PATHOLOGIES_ALL, WA_FEMALE, {
      limit: 50,
      order: [...sure].reverse(),
    })
      .filter((h) => h.score === 3)
      .map((h) => h.pathology.key);
    expect(flipped[0]).toBe(sure.at(-1));
    expect(flipped[1]).toBe(sure.at(-2));
  });
});

describe("the box is mounted where the chips are", () => {
  const composer = readFileSync("src/components/studio/usg/UsgComposer.tsx", "utf8");
  const box = readFileSync("src/components/studio/usg/composer/FindingSearch.tsx", "utf8");

  it("applies a result through the same toggle the chip row uses", () => {
    expect(composer).toMatch(/onApply=\{\(organKey, key\) => togglePathology\(organKey, key\)\}/);
    expect(box).toMatch(/onApply\(hit\.organKey, hit\.pathology\.key\)/);
  });

  it("is not offered on a signed report, where chips are locked", () => {
    expect(composer).toMatch(/!isFinal && study\.organs\.length > 0/);
    expect(composer).toMatch(/<FindingSearch/);
  });

  it("is told which card he is writing on", () => {
    expect(composer).toMatch(/preferredOrganKey=\{study\.organs\[focusedOrganIdx\]\?\.key\}/);
    // A new array every render would re-run the search on every keystroke of the
    // rest of the report, so the organ list is memoised.
    expect(composer).toMatch(/const chipOrgans = useMemo\(/);
  });

  it("stays open for the next finding, because a report takes several", () => {
    // Anchored at the start of a line: `// setQuery("")` would otherwise satisfy
    // a plain substring search while doing nothing at all.
    expect(box).toMatch(/\n\s*setQuery\(""\);/);
    expect(box).toMatch(/\n\s*inputRef\.current\?\.focus\(\);/);
  });

  it("answers the same key the register's search box answers", () => {
    expect(box).toMatch(/if \(e\.key !== "\/"\) return;/);
    expect(box).toMatch(/t\.tagName === "INPUT" \|\| t\.tagName === "TEXTAREA" \|\| t\.isContentEditable/);
  });
});
