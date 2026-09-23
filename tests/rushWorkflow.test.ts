/**
 * Peak-time rush workflow extras — NP template seeds + fatty · no size chips + presets.
 */
import { describe, expect, it } from "vitest";
import {
  BUILTIN_NP_TEMPLATES,
  buildNpTemplateState,
} from "@/lib/usg/npTemplates";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";
import { LIVER_N, getStudy } from "@/lib/usg/studies";
import {
  applyRushPreset,
  isCleanRushFinalize,
  studyAllowsRushNormals,
} from "@/lib/usg/quickActions";
import { matchSnippet, getAllSnippets } from "@/lib/usg/textExpansion";

describe("NP template seeds", () => {
  it("ships WA / Upper / KUB / TVS / LA definitions", () => {
    expect(BUILTIN_NP_TEMPLATES.map((t) => t.studyKey)).toEqual([
      "wa-female",
      "wa-male",
      "wa-child",
      "ua",
      "kub",
      "tvs",
      "la-female",
      "la-male",
    ]);
  });

  it("buildNpTemplateState yields measurement-free organ text", () => {
    const female = buildNpTemplateState("wa-female");
    expect(female.studyKey).toBe("wa-female");
    expect(female.organs.find((o) => o.organ === "liver")?.text).toBe(LIVER_N);
    expect(female.organs.every((o) => !/\{[a-z0-9_]+\}/i.test(o.text))).toBe(true);

    const kub = buildNpTemplateState("kub");
    expect(kub.organs.every((o) => !/\{[a-z0-9_]+\}/i.test(o.text))).toBe(true);
    expect(kub.organs.every((o) => Object.keys(o.vars).length === 0)).toBe(true);

    const tvs = buildNpTemplateState("tvs");
    expect(tvs.organs.every((o) => !/\{[a-z0-9_]+\}/i.test(o.text))).toBe(true);
  });
});

describe("fatty · no size pathology chips", () => {
  const nosizeKeys = [
    "liver-fatty-g1-nosize",
    "liver-hepatomegaly-fatty-g1-nosize",
    "liver-fatty-g2-nosize",
    "liver-coarse-nosize",
    "gb-calculus-nosize",
    "spleen-splenomegaly-nosize",
    "kidney-cyst-nosize",
    "prostate-enlarged-nosize",
    "uterus-bulky-nosize",
    "adnexa-cyst-simple-nosize",
  ];

  it("adds no-size variants for peak almost-normals", () => {
    for (const key of nosizeKeys) {
      const p = USG_PATHOLOGIES.find((x) => x.key === key);
      expect(p, key).toBeDefined();
      expect(p!.label.toLowerCase()).toContain("no size");
      expect(p!.text).not.toMatch(/\{span\}/);
      expect(p!.text).not.toMatch(/\{len\}/);
      expect(p!.text).not.toMatch(/\{size\}/);
      expect(p!.text).not.toMatch(/\{u1\}/);
      expect(p!.vars?.some((v) => ["span", "len", "size", "u1", "d1", "p1"].includes(v.key)) ?? false).toBe(false);
    }
  });
});

describe("rush safety + presets", () => {
  it("blocks rush on combo OB studies (wa-ob / tvs-ob)", () => {
    expect(studyAllowsRushNormals(getStudy("wa-ob")!)).toBe(false);
    expect(studyAllowsRushNormals(getStudy("tvs-ob")!)).toBe(false);
    expect(studyAllowsRushNormals(getStudy("ob")!)).toBe(false);
    expect(studyAllowsRushNormals(getStudy("wa-female")!)).toBe(true);
  });

  it("applyRushPreset adds fatty Gr I · no size on abdomen", () => {
    const study = getStudy("wa-female")!;
    const base = buildNpTemplateState("wa-female");
    const next = applyRushPreset(base, study, "fatty-g1", (k) => USG_PATHOLOGIES.find((p) => p.key === k));
    expect(next).not.toBeNull();
    const liver = next!.organs.find((o) => o.organ === "liver")!;
    expect(liver.pathologies).toContain("liver-fatty-g1-nosize");
    expect(liver.text).not.toMatch(/\{span\}/);
    expect(isCleanRushFinalize(next!)).toBe(true);
  });
});

describe("text expansion keys resolve", () => {
  it("every live snippet points at a real pathology", () => {
    const keys = new Set(USG_PATHOLOGIES.map((p) => p.key));
    for (const s of getAllSnippets()) {
      expect(keys.has(s.pathologyKey), s.trigger).toBe(true);
    }
  });

  it("fatty1n matches the no-size chip", () => {
    expect(matchSnippet("fatty1n")?.pathologyKey).toBe("liver-fatty-g1-nosize");
    expect(matchSnippet("fatty1")?.pathologyKey).toBe("liver-fatty-g1");
  });
});
