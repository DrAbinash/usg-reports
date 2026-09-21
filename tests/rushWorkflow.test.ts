/**
 * Peak-time rush workflow extras — NP template seeds + fatty · no size chips.
 */
import { describe, expect, it } from "vitest";
import { BUILTIN_NP_TEMPLATES, buildNpTemplateState } from "@/lib/usg/npTemplates";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";
import { LIVER_N } from "@/lib/usg/studies";

describe("NP template seeds", () => {
  it("ships pinned WA Female / Male / Child / Upper definitions", () => {
    expect(BUILTIN_NP_TEMPLATES.map((t) => t.name)).toEqual([
      "NP Whole Abdomen — Female",
      "NP Whole Abdomen — Male",
      "NP Whole Abdomen — Child",
      "NP Upper Abdomen",
    ]);
    expect(BUILTIN_NP_TEMPLATES.every((t) => t.sortOrder > 0)).toBe(true);
  });

  it("buildNpTemplateState yields measurement-free organ text", () => {
    const female = buildNpTemplateState("wa-female");
    expect(female.studyKey).toBe("wa-female");
    expect(female.organs.find((o) => o.organ === "liver")?.text).toBe(LIVER_N);
    expect(female.organs.every((o) => !/\{[a-z0-9_]+\}/i.test(o.text))).toBe(true);

    const child = buildNpTemplateState("wa-child");
    expect(child.organs.find((o) => o.organ === "liver")?.text).toBe(LIVER_N);
    expect(child.organs.find((o) => o.organ === "liver")?.text).not.toMatch(/\{span\}/);
    expect(child.organs.every((o) => Object.keys(o.vars).length === 0)).toBe(true);
  });
});

describe("fatty · no size pathology chips", () => {
  const nosizeKeys = [
    "liver-fatty-g1-nosize",
    "liver-hepatomegaly-fatty-g1-nosize",
    "liver-fatty-g2-nosize",
    "liver-coarse-nosize",
  ];

  it("adds no-size variants next to measured fatty chips", () => {
    for (const key of nosizeKeys) {
      const p = USG_PATHOLOGIES.find((x) => x.key === key);
      expect(p, key).toBeDefined();
      expect(p!.organ).toBe("liver");
      expect(p!.label.toLowerCase()).toContain("no size");
      expect(p!.text).not.toMatch(/\{span\}/);
      expect(p!.text).not.toMatch(/\{pv\}/);
      expect(p!.vars ?? []).toHaveLength(0);
    }
  });

  it("keeps the same clinical impression as the measured sibling", () => {
    const g1 = USG_PATHOLOGIES.find((p) => p.key === "liver-fatty-g1")!;
    const g1q = USG_PATHOLOGIES.find((p) => p.key === "liver-fatty-g1-nosize")!;
    expect(g1q.impression).toEqual(g1.impression);
    expect(g1q.titleFragment).toBe(g1.titleFragment);
  });
});
