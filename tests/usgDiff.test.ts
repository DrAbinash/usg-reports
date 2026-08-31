/**
 * Follow-up diff tests (v5 phase 2) — the pure computeDiff engine.
 *
 * Clinical contract: a follow-up draft opens with everything identical to the
 * last scan (no changes); as the doctor edits, only real deltas appear —
 * measurement moves, pathologies added/resolved, wording edits. "14.2" and
 * "14.20" are the same number to a sonologist, not a change.
 */
import { describe, expect, it } from "vitest";
import { computeDiff } from "@/lib/usg/diff";
import { initialState } from "@/lib/usg/studies";
import { applyPathologies, makeLookup, setOrganVar, setOrganText } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import type { UsgComposerState } from "@/lib/usg/types";

const lookup = makeLookup(USG_PATHOLOGIES_ALL);

function freshWa(): UsgComposerState {
  return initialState("wa-female");
}

describe("computeDiff — identical follow-up", () => {
  it("reports nothing when the draft is an untouched duplicate", () => {
    const prev = freshWa();
    const d = computeDiff(prev, structuredClone(prev), USG_PATHOLOGIES_ALL, []);
    expect(d.measurements).toEqual([]);
    expect(d.addedPathologies).toEqual([]);
    expect(d.clearedPathologies).toEqual([]);
    expect(d.findings).toEqual([]);
    expect(d.impression).toBeNull();
  });

  it("returns the empty diff when there is no previous scan", () => {
    const d = computeDiff(null, freshWa(), USG_PATHOLOGIES_ALL, null);
    expect(d.measurements).toEqual([]);
    expect(d.findings).toEqual([]);
  });
});

describe("computeDiff — measurement deltas", () => {
  it("flags a changed liver span with the human label and unit", () => {
    const prev = setOrganVar(freshWa(), "liver", "span", "14.2");
    const next = setOrganVar(prev, "liver", "span", "15.6");
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL);
    // Find the liver-fatty entry to get its var label context
    expect(d.measurements).toHaveLength(1);
    expect(d.measurements[0].organLabel).toBe("LIVER");
    expect(d.measurements[0].from).toBe("14.2");
    expect(d.measurements[0].to).toBe("15.6");
  });

  it("treats 14.2 and 14.20 as the same measurement (no noise)", () => {
    const prev = setOrganVar(freshWa(), "liver", "span", "14.2");
    const next = setOrganVar(freshWa(), "liver", "span", "14.20");
    expect(computeDiff(prev, next, USG_PATHOLOGIES_ALL).measurements).toHaveLength(0);
  });

  it("a measurement cleared on follow-up shows from → empty", () => {
    const prev = setOrganVar(freshWa(), "liver", "span", "14.2");
    const next = freshWa();
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL);
    expect(d.measurements[0].from).toBe("14.2");
    expect(d.measurements[0].to).toBe("");
  });
});

describe("computeDiff — pathology selection changes", () => {
  it("shows a newly selected fatty liver as added", () => {
    const prev = freshWa();
    const next = applyPathologies(prev, "liver", ["liver-fatty-g1"], lookup);
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL);
    expect(d.addedPathologies.map((p) => p.organLabel)).toContain("LIVER");
    expect(d.clearedPathologies).toEqual([]);
  });

  it("shows a resolved pathology as cleared when the follow-up normalises", () => {
    const prev = applyPathologies(freshWa(), "liver", ["liver-fatty-g1"], lookup);
    const next = freshWa();
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL);
    expect(d.clearedPathologies).toHaveLength(1);
    expect(d.addedPathologies).toHaveLength(0);
  });
});

describe("computeDiff — wording changes", () => {
  it("flags hand-edited organ text, truncated for display", () => {
    const prev = freshWa();
    const next = setOrganText(prev, "gb", "Gall bladder is mildly distended with a 6 mm intramural polyp.");
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL);
    expect(d.findings).toHaveLength(1);
    expect(d.findings[0].organLabel).toBe("G. B");
    expect(d.findings[0].to).toContain("polyp");
    expect(d.findings[0].from).toContain("Gall bladder");
  });
});

describe("computeDiff — impression lines", () => {
  it("flags a changed manual impression", () => {
    const prev = freshWa();
    const next: UsgComposerState = { ...freshWa(), impressionOverride: "Fatty liver, advice LFT." };
    const d = computeDiff(prev, next, USG_PATHOLOGIES_ALL, ["Normal scan of whole abdomen."]);
    expect(d.impression).toEqual({ from: ["Normal scan of whole abdomen."], to: ["Fatty liver, advice LFT."] });
  });

  it("no impression diff when the previous impression column is empty", () => {
    const next: UsgComposerState = { ...freshWa(), impressionOverride: "Something." };
    expect(computeDiff(freshWa(), next, USG_PATHOLOGIES_ALL, []).impression).toBeNull();
  });
});
